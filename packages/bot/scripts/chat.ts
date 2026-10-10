/**
 * Terminal chat with the bot (no WhatsApp needed). Uses the mock core API.
 *   npm run chat -w @raktdoot/bot                    → rules only
 *   node --env-file=../../.env scripts/chat.ts       → with Gemini/Groq
 * Type "/btn <id>" to press a button (ids are shown), "/loc 18.52 73.85" to share a location.
 */
import { createInterface } from "node:readline/promises";
import { createBotFromEnv } from "../src/create-bot.ts";
import { simulate } from "../src/channels/simulator-adapter.ts";

const { bot, providers } = createBotFromEnv();
const from = "+919800000001";
console.log(`RaktDoot bot chat · AI: ${providers.join(" → ") || "off (rules only)"} · type "exit" to quit\n`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
for (;;) {
  const line = (await rl.question("you> ")).trim();
  if (line === "exit") break;
  const btn = /^\/btn\s+(\S+)/.exec(line);
  const loc = /^\/loc\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(line);
  const input = btn ? { from, buttonId: btn[1]! } : loc ? { from, location: { lat: Number(loc[1]), lng: Number(loc[2]) } } : { from, text: line };
  for (const r of await simulate(input, bot)) {
    console.log(`\nbot> ${r.text}`);
    for (const b of r.buttons ?? []) console.log(`     [${b.title}]  /btn ${b.id}`);
    if (r.kind === "location_request") console.log("     (share: /loc <lat> <lng>, or type your area)");
  }
  console.log();
}
rl.close();