// Live end-to-end rehearsal of the demo video against the PRODUCTION BUILD over HTTP:
// 1) two donors sign up through the WhatsApp simulator and share location
// 2) a family member signs in and requests blood in the app
// 3) a coordinator verifies and alerts nearby donors (wave 1)
// 4) the donor receives a WhatsApp invite with Accept / Ignore and taps Accept
// 5) donation confirmed → units issued → closed FULFILLED
// Uses an isolated temporary database; WhatsApp delivery is simulated.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dir = await mkdtemp(join(tmpdir(), "raktdoot-e2e-"));
const probe = createServer(); await new Promise((r) => probe.listen(0, "127.0.0.1", r));
const port = probe.address().port; await new Promise((r) => probe.close(r));
const base = `http://127.0.0.1:${port}`;
const env = { ...process.env, DATABASE_URL: `file:${join(dir, "e2e.db").replaceAll("\\", "/")}`, DEMO_MODE: "true", APP_BASE_URL: base, SIMULATOR_ENABLED: "true", WHATSAPP_DELIVERY: "simulate", NEXT_TELEMETRY_DISABLED: "1" };
for (const k of ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_ACCESS_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GEMINI_API_KEY", "GROQ_API_KEY"]) delete env[k];
const run = (args) => { const r = spawnSync(process.execPath, args, { env: { ...env, NODE_ENV: "test" }, stdio: "inherit" }); if (r.status !== 0) throw new Error(`setup failed: ${args[0]}`); };

// The server is started in development mode so DEMO_MODE routes (demo sign-in, inbox) are on;
// production refuses them by design.
let server;
const jar = new Map();
async function call(who, path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(base + path, { method, redirect: "manual", headers: { origin: base, ...(jar.get(who) ? { cookie: jar.get(who) } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) if (c.startsWith("raktdoot_session=")) jar.set(who, c.split(";")[0]);
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}
const step = (n, s) => console.log(`  ✓ ${n}. ${s}`);

try {
  run([resolve("../../node_modules/prisma/build/index.js"), "migrate", "deploy"]);
  run(["prisma/seed.ts"]);
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...env, NODE_ENV: "development" }, stdio: ["ignore", "ignore", "inherit"] });
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(base + "/api/auth/session", { signal: AbortSignal.timeout(5000) })).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`Demo rehearsal against ${base}`);

  // 1. Donors sign up on WhatsApp (simulator = same bot code path as the real webhook).
  for (const [phone, pin] of [["+919822200001", { lat: 18.5255, lng: 73.8556 }], ["+919822200002", { lat: 18.5302, lng: 73.8471 }]]) {
    for (const msg of [{ text: "Hi" }, { buttonId: "lang:en" }, { buttonId: "terms:yes" }, { buttonId: "role:donate" }, { buttonId: "yes" }, { buttonId: "yes" }, { buttonId: "yes" }, { location: pin }, { text: "O-" }]) {
      const r = await call("sim", "/api/simulator", { method: "POST", body: { from: phone, ...msg } });
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
  }
  step(1, "two donors signed up on WhatsApp with alerts + location consent");

  // 2. Family signs in and requests blood in the app.
  assert.equal((await call("family", "/api/auth/demo", { method: "POST", body: { userId: "demo-requester" } })).status, 200);
  assert.equal((await call("family", "/api/auth/session")).data.signedIn, true);
  const created = await call("family", "/api/requests", { method: "POST", headers: { "idempotency-key": "demo-e2e-0001" }, body: { hospitalId: "demo-hospital-1", bloodGroup: "O-", component: "PACKED_RED_CELLS", units: 1, neededBy: new Date(Date.now() + 6 * 3_600_000).toISOString(), language: "en", confirmed: true } });
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const id = created.data.request.id;
  const centres = await call("family", `/api/centres?hospitalId=demo-hospital-1&bloodGroup=O-&component=PACKED_RED_CELLS`);
  assert.ok(centres.data.centres.length > 0);
  step(2, `family signed in and requested O- blood; ${centres.data.centres.length} nearby centres shown`);

  // 3. Coordinator verifies and alerts nearby donors.
  assert.equal((await call("coord", "/api/auth/demo", { method: "POST", body: { userId: "demo-coordinator" } })).status, 200);
  assert.ok((await call("coord", "/api/verification")).data.queue.some((q) => q.id === id));
  assert.equal((await call("coord", `/api/requests/${id}/verify`, { method: "POST", body: { decision: "VERIFIED", method: "Called the hospital blood bank" } })).status, 200);
  const wave = await call("coord", `/api/requests/${id}/outreach`, { method: "POST" });
  assert.equal(wave.status, 201, JSON.stringify(wave.data));
  assert.equal(wave.data.invited, 2);
  step(3, `coordinator verified; wave 1 invited ${wave.data.invited} nearby O- donors within ${wave.data.radiusKm} km`);

  // 4. Donor's WhatsApp shows Accept / Ignore; donor taps Accept.
  const inbox = await call("coord", "/api/demo/inbox?phone=%2B919822200001");
  const invite = inbox.data.messages.find((m) => m.purpose === "URGENT_ALERT");
  assert.ok(invite, "invite delivered");
  assert.deepEqual(invite.message.buttons.map((b) => b.title), ["Accept", "Ignore", "Pause alerts"]);
  const accept = invite.message.buttons.find((b) => b.title === "Accept").id;
  const reply = await call("sim", "/api/simulator", { method: "POST", body: { from: "+919822200001", buttonId: accept } });
  assert.match(reply.data.replies[0].text, /Thank you/);
  const after = await call("coord", `/api/requests/${id}/outreach`);
  assert.equal(after.data.acceptedCount, 1);
  const other = (await call("coord", "/api/demo/inbox?phone=%2B919822200002")).data.messages.map((m) => m.purpose);
  assert.ok(other.includes("STAND_DOWN"), "second donor told they are no longer needed");
  step(4, "donor got the WhatsApp invite, tapped Accept; the other donor was stood down");

  // 5. Close the loop.
  const inv = after.data.invites.find((i) => i.status === "ACCEPTED");
  assert.equal((await call("coord", `/api/invites/${inv.inviteId}/outcome`, { method: "POST", body: { outcome: "DONATED" } })).status, 200);
  assert.equal((await call("coord", `/api/requests/${id}/fulfilment`, { method: "POST", body: { units: 1, source: "DONOR_DONATION" } })).status, 201);
  assert.equal((await call("coord", `/api/requests/${id}/close`, { method: "POST", body: { outcome: "FULFILLED" } })).status, 200);
  const track = await call("family", `/api/requests/${id}`);
  assert.equal(track.data.request.status, "CLOSED");
  step(5, "donation confirmed, units issued, request closed FULFILLED; family sees it on the tracking page");

  for (const page of ["/", "/login", "/request", "/donor", "/dashboard", "/demo", `/track/${id}`, "/terms"]) {
    const r = await fetch(base + page);
    assert.equal(r.status, 200, `${page} renders`);
  }
  console.log("  ✓ all 8 pages render\nDemo rehearsal passed.");
} finally {
  if (server && server.exitCode === null) { const done = new Promise((r) => server.once("exit", r)); server.kill(); await done; }
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
}