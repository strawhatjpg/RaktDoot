# Free stack (no paid services)

Checked 10 Oct 2026. Limits change; confirm on each dashboard at kickoff.

## AI models

| Use | Primary (free) | Fallback (free) | Notes |
|---|---|---|---|
| Extraction, translation, replies (Hindi, Hinglish, Marathi, English) | **Google Gemini API free tier** (current Flash / Flash-Lite model) | **Groq free plan** `openai/gpt-oss-20b` (30 RPM, 1K RPD) | Gemini free-tier content may be used by Google to improve products: **use demo data only, no real patient data** |
| Voice notes → text | Groq `whisper-large-v3-turbo` (20 RPM, 2K RPD) | Gemini audio input | Optional: Sarvam AI (₹100 free signup credits) for Indian-language speech |
| Coordinator Copilot | `@cline/sdk` with the Gemini free key (SDK supports Google and OpenAI-compatible providers) | Groq via OpenAI-compatible provider | Keep tool calls few; cache briefings |
| Forecasting | scikit-learn on our machine | — | No API cost |

Rate-limit protection: cache translations of fixed strings, retry with backoff on 429, switch to fallback provider, one shared project key per provider for the demo.

## WhatsApp: yes, free for the hackathon

| Item | Cost |
|---|---|
| Meta developer account, app, **test phone number** | Free |
| Messages the user sends us | Free |
| Our replies within 24 h of the user's last message (text, buttons, location request) | **Free** |
| Utility templates sent within that 24 h window | Free |
| Templates sent **outside** the 24 h window (e.g. a 90-day reminder) | **Charged**, needs a payment method |

Implications:
- Test numbers only message a few pre-registered recipient phones; add the team's phones.
- Demo reminders: have the donor message the bot first (window open → free) or send the reminder by **app push** (free).
- Production reminders on WhatsApp would cost per template; app push stays free.
- Meta's "AI Provider" pricing targets general-purpose AI assistants, not task bots, and India is not on its list. Since Jan 2026 Meta only allows general-purpose AI assistants in specific markets, so **keep the bot task-specific** (blood requests and donors), not an open chatbot.

## Hosting and push

- Render / Railway free tiers for web + worker + forecast service (free instances may sleep; wake them before the demo).
- Web Push with self-generated VAPID keys: free.