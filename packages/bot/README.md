# @raktdoot/bot — Member 1 (WhatsApp bot + multilingual AI)

Framework-free TypeScript (runs on Node 22.18+ with no build step). Lives in its own package so it
never conflicts with Member 2's `apps/web` scaffold; Next.js routes import it as `@raktdoot/bot`.

## What's here

| File | Purpose |
|---|---|
| `src/conversation/bot-flow.ts` | `processInbound(InboundMessage, deps) → OutboundMessage[]` — language → terms → role → intake/follow-ups/confirm, donor consents, location, STOP/START/HELP/STATUS/LOCATION/DELETE MY DATA/LOGIN |
| `src/ai/extract-request.ts` | AI extraction (Gemini → Groq fallback) + schema validation + rule-based merge; works offline |
| `src/ai/normalize.ts`, `parse-time.ts`, `detect-language.ts` | Deterministic safety net: "B+ve"/"बी पॉजिटिव" → `B+`, units, "aaj shaam 6 baje" → ISO, en/hi/hi-Latn/mr detection |
| `src/ai/translate.ts` | AI translation of dynamic text only, glossary + protected tokens (blood groups, IDs, URLs) + cache |
| `src/ai/transcribe.ts` | Voice notes → text via Groq Whisper (free) |
| `src/i18n/` | Reviewed bot strings in en / hi / hi-Latn / mr (safety text is never AI-generated) |
| `src/channels/` | WhatsApp webhook parser, signature check, Graph API client (send, media download, read receipts), webhook handler, simulator adapter |
| `src/auth/whatsapp-login.ts` | "Log in with WhatsApp" codes (6 digits, 5 min, single use) |
| `src/core-api.ts` | **`CoreApi` interface M2 implements** + in-memory mock |

## Run

```bash
npm test                 # all tests (repo root)
npm run bot:chat         # chat with the bot in the terminal (uses .env if present)
npm run evals            # offline multilingual score → evals/multilingual/results-rules.md
npm run evals:ai         # with Gemini/Groq → evals/multilingual/results.md
```

## Integration for Member 2 (`apps/web`)

1. Add `"@raktdoot/bot": "0.1.0"` to `apps/web/package.json` dependencies.
2. Implement `CoreApi` with Prisma (state can be a JSON column on `User`), pass it to `createBotFromEnv(process.env, { core })`.
3. Routes:

```ts
// app/api/whatsapp/webhook/route.ts
import { after } from "next/server";
import { handleVerify, handleWebhook } from "@raktdoot/bot";
export async function GET(req: Request) {
  const r = handleVerify(new URL(req.url), process.env.WHATSAPP_VERIFY_TOKEN!);
  return new Response(r.body, { status: r.status });
}
export async function POST(req: Request) {
  const raw = await req.text();
  const r = handleWebhook(raw, req.headers.get("x-hub-signature-256"), { bot, client: client!, appSecret: process.env.WHATSAPP_APP_SECRET!, verifyToken: process.env.WHATSAPP_VERIFY_TOKEN! });
  after(r.done);              // reply 200 fast, process in background
  return new Response(null, { status: r.status });
}
// app/api/simulator/route.ts  →  simulate(await req.json(), bot)  → JSON replies (M4's page)
// app/api/auth/whatsapp/{start,poll}  →  login.start(WHATSAPP_BOT_NUMBER) / login.poll(code)
```

4. Donor alerts from outreach waves: send `kind: "buttons"` with button ids `invite:<inviteId>:accept|decline|pause`;
   the bot forwards taps to `core.respondToInvite`.

## Known limits

- Eval cases were written by the team, so the offline score is optimistic; add real-style messages from testers.
- Marathi and Hindi strings need a native-speaker review before a real pilot.
- Typed area names are stored as labels; geocoding them is M2's job.