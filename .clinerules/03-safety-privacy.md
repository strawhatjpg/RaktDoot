# Safety and privacy rules

- Donors are always directed to a **licensed blood centre**. Never build person-to-person collection flows.
- Private donors are contacted only for **verified** requests (`canStartDonorOutreach`). Public centre listings need no verification.
- Consent is asked in-chat or in-app, per purpose (`CONSENT_TYPES`), stored with timestamp, and withdrawable. Terms acceptance alone never implies alert, reminder, location or contact-sharing consent.
- Donor coordinates are coarsened (`coarsenCoordinates`) before storage. Donor phone numbers are never shown to requesters without CONTACT_SHARING consent.
- Eligibility dates are **provisional**. Messages say "you may be eligible", never "you are eligible".
- A donor accepting is not fulfilment. Only staff close requests (`checkTransition`).
- No cash, transferable points or substantial gifts for donors. Token rewards stay behind `FEATURE_TOKEN_REWARDS=false`.
- Simulated data (stock, history, forecasts) must be visibly labelled as simulated in the UI.