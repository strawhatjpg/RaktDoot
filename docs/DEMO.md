# Demo video guide

The demo story the team asked for, end to end, and how to run it.

> **Verified automatically:** `npm run test:demo` replays this exact story over HTTP
> against a real server (two WhatsApp donors sign up → family requests in the app →
> coordinator verifies → WhatsApp invite with Accept/Ignore → Accept → stand-down →
> donation → fulfilled). It passes on the current branch.

## One-time setup

```powershell
npm.cmd install
Copy-Item .env.example .env        # then edit .env (below)
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed                # needs DEMO_MODE=true
```

Minimum `.env` for the recording:

| Variable | Value |
|---|---|
| `DEMO_MODE` | `true` (enables demo sign-in buttons and the WhatsApp inbox page) |
| `FEATURE_TOKEN_REWARDS` | `true` (coins, referral links, sponsor store) |
| `APP_BASE_URL` | `http://localhost:3000` (or your public tunnel URL, see WhatsApp below) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Google Cloud Console, redirect URI `<APP_BASE_URL>/api/auth/google/callback` |
| WhatsApp variables | optional; without them every message appears on `/demo` as *simulated* |

Run two terminals:

```powershell
npm.cmd run dev       # web app on http://localhost:3000
npm.cmd run worker    # waves, reminders, retries
```

## Real WhatsApp on phones (optional, recommended for the video)

1. Meta developer app → WhatsApp → test number; add each phone as a recipient (test numbers only message registered recipients).
2. Expose the dev server publicly, e.g. `cloudflared tunnel --url http://localhost:3000`; set `APP_BASE_URL` to that URL.
3. Webhook URL `<APP_BASE_URL>/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
4. Fill `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_BOT_NUMBER`.

**Free-window rule:** Meta delivers our button messages free only within 24 h of that
person's last message to the bot. Each donor phone should message the bot (it will,
while signing up) shortly before recording. Outside the window the send fails and the
inbox shows it as *failed*; the fix in production is an approved template.

## Shot list (≈3 minutes)

1. **Donor signs up on WhatsApp** (phone screen): "Hi" → English → I agree → *I want to donate* → Yes to alerts, reminders, location → share location pin → type blood group (e.g. `O-`). Repeat on a second phone, nearby.
2. **Family signs in** (laptop): `/login` → *Continue with Google* → Google consent → back on the app.
3. **Request blood**: `/request` → hospital, `O-`, packed red cells, 1 unit → Review → Confirm. The tracking page shows nearby centres with "fictional / simulated, updated X min ago" labels and *Pending review*.
4. **Coordinator verifies** (second browser profile): `/login` → *Coordinator (Pune)* → `/dashboard` → *Verify*. The explained matches show each donor's distance and reasons.
5. **Alert donors**: *📲 Alert nearby donors on WhatsApp*. Both phones receive the invite with **Accept / Ignore / Pause alerts**. (Without WhatsApp configured, show `/demo`.)
6. **Donor taps Accept**: the donor gets the request ID and centre instructions; the second donor gets "no longer needed"; the dashboard shows *1/1 committed*; the family's tracking page updates by itself.
7. **Close the loop**: *Donated* → certificate code on the donor's phone → *Record units issued* → *Close as fulfilled*. The family timeline ends in *Closed*.
8. **Rewards**: the donor's WhatsApp says they earned 100 coins. On `/rewards`, show the balance, the referral link (*Share on WhatsApp*), and redeem a sponsor coupon (e.g. *Free filter coffee* → `DEMO-CAFE-0001`).
   For the referral shot, open `/rewards` as the family member first, copy their link, and have the second donor phone open it → *Join on WhatsApp* (sends `JOIN <code>`) → sign up as donor → the referrer's balance shows +25.
9. (Optional) Copilot / forecast pages from Member 3.

Safety lines to say on camera: donors are contacted only for **verified** requests;
only donors who **opted in** to alerts and location are matched; donation happens only
at a **licensed blood centre**; accepting is **not** fulfilment.

## What is simulated

- Hospitals, centres, stock and the 40 seeded donors are fictional; seeded donors are never really messaged.
- Verification is a coordinator's recorded judgement ("called the hospital"), not an integration with a hospital system.
- Matching uses straight-line distance, not travel time.