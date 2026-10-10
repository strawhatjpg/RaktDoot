# Pipelines

## A. Multilingual intake (AI pillar 1)

```
Text / voice note
  voice → download media → speech-to-text → text
1. Detect language + script (e.g. Hindi in Latin script, Marathi in Devanagari)
2. LLM extracts { hospital, blood_group, component, units, needed_by, patient_ref }
   + per-field confidence + missing fields  → schema-validated
3. Deterministic normalisation ("B+ve", "बी पॉजिटिव" → B+)
4. Missing / low-confidence → follow-up question in the user's language
5. Confirmation card in the user's language → [Confirm] [Edit]
6. Store canonical English + original text
Outbound: reviewed i18n strings; non-critical text translated with a glossary and cached.
Quality: evals/multilingual scores per-field accuracy; result goes in the README.
```

## B. Request → discovery → verification → matching → waves

```
Confirmed request
1. Centres near the TREATING HOSPITAL, filtered by component, sorted by distance,
   freshness, confirmation → shown to family immediately (no verification needed)
2. Verification
   staff-raised → VERIFIED automatically
   family-raised → PENDING_REVIEW → coordinator / hospital confirms
3. Stock confirmed by centre? yes → STOCK_CONFIRMED → close when issued
4. Not confirmed AND verified → matching
   FILTER: URGENT_ALERTS consent · available · location set · within travel radius ·
           past provisional interval · not committed elsewhere
   RANK (explained): availability freshness 0.35 · distance 0.30 ·
                     stated arrival time 0.15 · recent alert load 0.20
5. Wave 1: top 5 → [Accept + ETA] [Decline] [Pause alerts]
6. Not enough → Wave 2 (wider radius, next 10) → Wave 3 (partner NGOs + coordinator)
7. Enough accepted → stand-down to everyone else
8. Donor goes to the LICENSED centre with the request ID
```

## C. Lifecycle

Implemented in `packages/shared/src/lifecycle.ts`.

```
DRAFT → AWAITING_CONFIRMATION → OPEN → CENTRES_LISTED
CENTRES_LISTED → STOCK_CONFIRMED | OUTREACH_ACTIVE (verified only)
OUTREACH_ACTIVE → DONOR_ACCEPTED → DONOR_ARRIVED → DONATION_CONFIRMED (centre/coordinator)
Fallbacks: donor drops out / deferred at screening / more units needed → OUTREACH_ACTIVE
Any stage → CLOSED with outcome FULFILLED | CANCELLED | EXPIRED | UNRESOLVED
  staff may use any outcome; requester may only CANCEL own request; staff may reopen
```

## D. Donor lifecycle, location and reminders

```
Join (WhatsApp / app) → accept terms → consent buttons, one per purpose:
   [Urgent alerts] [Donation reminders] [Store my location] [Share contact when I accept]
→ profile: blood group, sex (for interval), travel radius, preferred language
→ location: send WhatsApp pin / tap "use my location" in app / type area
   stored at 2 decimals (~1 km); "LOCATION" command or app button updates it any time
   older than 30 days → gentle "still in <area>?" prompt
→ availability: available / paused / unavailable until <date>
→ donation confirmed by centre → interval resets → recognition badge/certificate
→ provisional interval passed (90 days male, 120 days female/unspecified)
   → reminder on each consented channel: WhatsApp template and/or Web Push
   → wording: "you may be eligible to donate again" + [Stop reminders]
```

## E. Demand forecasting (AI pillar 2)

```
Data: synthetic 3-year weekly history per district × blood group × component
      (dengue-season platelet surge, summer donation dip, festival effects, trend, noise)
      + live request history as it accrues + stock snapshots
Features: lags 1/2/4/52, rolling means, week of year, festival flag, stock trend
Models: seasonal-naive baseline vs gradient boosting with quantile loss (P10/P50/P90)
Backtest: rolling-origin; report MAE vs baseline on the dashboard
Output: 1–4 week ranges + shortage risk + top drivers
Use: Copilot briefing → proposed campaign → coordinator approves → opted-in eligible donors
Label: "Demonstrated on synthetic data" until real data exists
```

## F. Coordinator Copilot (Cline SDK)

```
Coordinator question (any language)
→ Cline SDK Agent with tools: get_open_requests, search_blood_centres, rank_donors,
  get_forecast, summarize_case, draft_outreach_message
→ summary + suggested actions + drafts
→ send / close / edit → explicit coordinator approval
```

## G. Auth and consent

```
WhatsApp: sender number = identity
App: "Log in with WhatsApp" → app shows code + wa.me link "LOGIN 482913"
     → user sends it → bot matches code (5-min expiry, single use) → session cookie
Staff: admin-created accounts with roles; never self-assigned
Consent: records of {type, channel, granted, time, source, terms version};
         latest record wins; "STOP" / app toggle withdraws; "DELETE MY DATA" erases profile
```