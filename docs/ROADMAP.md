# Roadmap and decisions

## Decisions log

| # | Decision | Reason |
|---|---|---|
| D1 | Mobile app = installable PWA, not native | One codebase, opens from a WhatsApp link, no store approval |
| D2 | **Live location → manual location updates** (WhatsApp pin, app GPS one-shot, typed area) any time, stored at ~1 km | WhatsApp sends one-time pins; background tracking is unreliable and invasive |
| D3 | **Consent asked in WhatsApp itself** with buttons per purpose (and in-app toggles), not only in T&C | Standard business-bot pattern; DPDP needs specific, withdrawable consent |
| D4 | **Reminders via WhatsApp or app push**, whichever the user consented to | WhatsApp after 24 h needs approved templates; push is free and a fallback |
| D5 | Rewards = non-monetary recognition now; token rewards flagged off | See `REWARDS_POLICY.md` |
| D6 | Prescription / slip reading **removed** | Cannot prove authenticity; verification is done by staff instead |
| D7 | Anyone can request; private donor outreach requires verification | See `USER_ROLES.md` |
| D8 | NGO / government partners = partner org accounts + camp listing; no claimed integrations | Honest scope for the hackathon |

## Feature priority

| Priority | Feature |
|---|---|
| P0 | WhatsApp bot + simulator, multilingual AI intake, blood-centre-first discovery, request verification, smart matching, wave outreach, closed-loop lifecycle, auth (WhatsApp identity + "Log in with WhatsApp"), in-chat consent, manual location updates |
| P0 (AI) | Demand forecasting service with backtesting; Coordinator Copilot (Cline SDK) |
| P1 | Reminders (WhatsApp template + Web Push), recognition (certificates, badges), PWA install, voice notes |
| P2 | Partner org accounts, camp listing, second regional language |
| Off | Token rewards (flag), prescription reading |

## Build order (8 hours)

| Time | Milestone | Done when |
|---|---|---|
| 0:00–0:30 | Validate WhatsApp test number + LLM key; start screen recording | Bot echoes a message |
| 0:30–2:00 | Next.js app, Prisma schema + seed, AI intake, simulator | Hinglish message → confirmed request |
| 2:00–3:30 | Centre discovery, verification queue, matching, waves, lifecycle | End-to-end in simulator |
| 3:30–4:30 | WhatsApp webhook, login, consent buttons, location update | End-to-end on a real phone |
| 4:30–5:45 | Forecast service, backtest, dashboard | Risk chart with ranges + error |
| 5:45–6:30 | Cline SDK Copilot + approval | Briefing + draft campaign |
| 6:30–7:15 | Reminders, push, recognition, "skip 90 days" demo control | Reminder delivered |
| 7:15–8:00 | Evals score, README, demo video, PPT | Submitted |

Cut order if late: voice → partner pages → push (keep WhatsApp) → recognition.

## Open decisions

1. LLM provider (Gemini / OpenAI / Anthropic) — test Indian-language quality in hour 1.
2. WhatsApp route: Meta Cloud API test number (recommended) or Twilio sandbox.
3. Pilot city and regional language.
4. Confirm with organisers whether code may be written before the 8-hour window.
5. Check the name "RaktDoot" is not taken.