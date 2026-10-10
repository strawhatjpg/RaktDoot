import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const dir = await mkdtemp(join(tmpdir(), "raktdoot-smoke-"));
const env = { ...process.env, DATABASE_URL: `file:${join(dir, "smoke.db").replaceAll("\\", "/")}`, DEMO_MODE: "true", NEXT_TELEMETRY_DISABLED: "1" };
function run(args) {
  const result = spawnSync(process.execPath, args, { env: { ...env, NODE_ENV: "test" }, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Smoke setup failed: ${args[0]}`);
}
let server;
try {
  run([resolve("../../node_modules/prisma/build/index.js"), "migrate", "deploy"]);
  run(["prisma/seed.ts"]);
  const probe = createServer();
  await new Promise((done) => probe.listen(0, "127.0.0.1", done));
  const port = probe.address().port;
  await new Promise((done, reject) => probe.close((error) => error ? reject(error) : done()));
  const base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [require.resolve("next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    env: { ...env, NODE_ENV: "production", APP_BASE_URL: base }, stdio: "inherit",
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Production server exited before readiness");
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) { assert.match(await response.text(), /RaktDoot/); ready = true; break; }
    } catch { /* Startup polling only; bounded below. */ }
    await new Promise((done) => setTimeout(done, 500));
  }
  assert.equal(ready, true, "Production server did not become ready");
  const hospitals = await fetch(`${base}/api/centres`);
  assert.equal(hospitals.status, 200);
  assert.equal((await hospitals.json()).hospitals.length, 2);
  const centres = await fetch(`${base}/api/centres?hospitalId=demo-hospital-1&bloodGroup=B%2B&component=PACKED_RED_CELLS`);
  assert.equal(centres.status, 200);
  assert.equal((await centres.json()).centres.length, 15);
  assert.equal((await fetch(`${base}/api/requests`)).status, 401);
  console.log("HTTP smoke passed: built home page, database-backed public discovery, protected requests.");
} finally {
  if (server && server.exitCode === null) {
    const closed = new Promise((done) => server.once("exit", done));
    server.kill();
    await closed;
  }
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}