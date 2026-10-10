import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryLoginStore, createWhatsAppLogin, parseLoginCommand, LOGIN_CODE_TTL_MS } from "../src/auth/whatsapp-login.ts";

test("login code: start → confirm via WhatsApp → poll once", async () => {
  let now = 1_000_000;
  const login = createWhatsAppLogin(createMemoryLoginStore(), () => now);
  const { code, link } = await login.start("+91 98000 00000");
  assert.match(code, /^\d{6}$/);
  assert.equal(link, `https://wa.me/919800000000?text=LOGIN%20${code}`);
  assert.deepEqual(await login.poll(code), { status: "pending" });
  assert.equal(parseLoginCommand(` login ${code} `), code);
  assert.equal(await login.confirm(code, "+919800000001"), true);
  assert.equal(await login.confirm(code, "+919800000002"), false, "cannot be re-bound");
  assert.deepEqual(await login.poll(code), { status: "confirmed", phone: "+919800000001" });
  assert.deepEqual(await login.poll(code), { status: "expired" }, "single use");
});

test("login code expires after 5 minutes", async () => {
  let now = 0;
  const login = createWhatsAppLogin(createMemoryLoginStore(), () => now);
  const { code } = await login.start("919800000000");
  now += LOGIN_CODE_TTL_MS + 1;
  assert.equal(await login.confirm(code, "+919800000001"), false);
  assert.equal(parseLoginCommand("LOGIN 12345"), null);
});