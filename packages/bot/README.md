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

**Done (M1):** `@raktdoot/bot` is a dependency of `apps/web` and in `transpilePackages`. Routes:

| Route | Purpose | Without keys |
|---|---|---|
| `GET/POST /api/whatsapp/webhook` | Meta handshake + signed messages; replies sent after the 200 | GET works; POST → 503 |
| `POST /api/simulator` | `{ from, text \| buttonId \| location }` → `{ replies }` for M4's `/simulator` page | Works (on in dev; prod needs `SIMULATOR_ENABLED=true`) |
| `POST /api/auth/whatsapp/start` | → `{ code, link, expiresAt }` + HttpOnly cookie binding the code to this browser | 503 until `WHATSAPP_BOT_NUMBER` is set |
| `POST /api/auth/whatsapp/poll` | `{ code }` → `pending` / `expired` / `confirmed` + M2 session cookie (`createSession`) | Works |

Wiring lives in `apps/web/src/server/bot/` (bot singleton, login-code browser binding, phone → user upsert; new users are always `REQUESTER`).

**Still open (M2):** implement `CoreApi` with Prisma and pass it in `apps/web/src/server/bot/index.ts` via
`createBotFromEnv(process.env, { core, loginStore })`. Until then the bot uses its in-memory mock (state resets on restart,
requests are not written to the DB). Mapping notes are in `docs/M2_HANDOFF.md`.

Donor alerts from outreach waves: send `kind: "buttons"` with button ids `invite:<inviteId>:accept|decline|pause`;
the bot forwards taps to `core.respondToInvite`.

## Known limits

- Eval cases were written by the team (and the rules were tuned while debugging), so the offline 100% is optimistic; add unseen messages from testers before quoting a number.
- Marathi and Hindi strings need a native-speaker review before a real pilot.
- Typed area names are stored as labels; geocoding them is M2's job.