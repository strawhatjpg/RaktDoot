import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { parseWebhook } from "../src/channels/webhook-parser.ts";
import { verifySignature, verifyHandshake } from "../src/channels/signature.ts";
import { toGraphPayload } from "../src/channels/whatsapp-client.ts";

const wrap = (messages: unknown[]) => ({
  object: "whatsapp_business_account",
  entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages } }] }],
});

test("parses text, button, location, audio; ignores statuses and stickers", () => {
  const out = parseWebhook(wrap([
    { from: "919800000001", id: "w1", timestamp: "1714510003", type: "text", text: { body: "B+ chahiye" } },
    { from: "919800000001", id: "w2", timestamp: "1714510004", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "yes", title: "Yes" } } },
    { from: "919800000001", id: "w3", timestamp: "1714510005", type: "location", location: { latitude: 18.52, longitude: 73.85, name: "Kothrud" } },
    { from: "919800000001", id: "w4", timestamp: "1714510006", type: "audio", audio: { id: "media-1", mime_type: "audio/ogg; codecs=opus" } },
    { from: "919800000001", id: "w5", type: "sticker", sticker: { id: "s" } },
  ]));
  assert.deepEqual(out.map((m) => m.kind), ["text", "button", "location", "audio"]);
  assert.equal(out[0]!.from, "+919800000001");
  assert.equal(out[0]!.receivedAt, new Date(1714510003000).toISOString());
  assert.equal(out[1]!.buttonId, "yes");
  assert.deepEqual(out[2]!.location, { lat: 18.52, lng: 73.85, label: "Kothrud" });
  assert.equal(out[3]!.audioMediaId, "media-1");
  assert.deepEqual(parseWebhook({ object: "page" }), []);
  assert.deepEqual(parseWebhook(null), []);
});

test("signature check uses HMAC-SHA256 of the raw body", () => {
  const body = '{"a":1}';
  const sig = "sha256=" + createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(verifySignature(body, sig, "secret"), true);
  assert.equal(verifySignature(body + " ", sig, "secret"), false);
  assert.equal(verifySignature(body, null, "secret"), false);
  assert.equal(verifySignature(body, "sha256=zz", "secret"), false);
});

test("handshake echoes challenge only with the right token", () => {
  const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "42" });
  assert.equal(verifyHandshake(ok, "tok"), "42");
  assert.equal(verifyHandshake(ok, "other"), null);
});

test("graph payload: buttons capped at 3 and 20-char titles", () => {
  const p = toGraphPayload({
    to: "+91 98000 00001", kind: "buttons", text: "Pick",
    buttons: [1, 2, 3, 4].map((i) => ({ id: `b${i}`, title: "A very long button title here" })),
  }) as { to: string; interactive: { action: { buttons: Array<{ reply: { title: string } }> } } };
  assert.equal(p.to, "919800000001");
  assert.equal(p.interactive.action.buttons.length, 3);
  assert.ok(p.interactive.action.buttons.every((b) => b.reply.title.length <= 20));
  const loc = toGraphPayload({ to: "+1", kind: "location_request", text: "Share" }) as { interactive: { type: string } };
  assert.equal(loc.interactive.type, "location_request_message");
});