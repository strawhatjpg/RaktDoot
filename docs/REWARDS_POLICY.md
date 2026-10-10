# Rewards policy

## Decision

**Ship non-monetary recognition now. Keep token rewards (coins, coupons) disabled behind `FEATURE_TOKEN_REWARDS=false` until written guidance is obtained from the State Blood Transfusion Council or a partner blood centre.**

## Why

- Voluntary blood donation, per the NBTC's use of the WHO definition, means no payment "in cash or kind" that could substitute for money.
- Maharashtra SBTC (November 2024) banned substantial gifts but allowed token items such as **meal coupons, badges, T-shirts, mementos and refreshments** ([report](https://indianexpress.com/article/cities/mumbai/sbtc-bans-substantial-gifts-incentives-ethos-voluntary-blood-donation-9671835/)).
- A store-redeemable coin system looks like a cash substitute and is the riskiest option.

## Options considered

| Option | Risk | Status |
|---|---|---|
| Digital certificate after centre-confirmed donation | Very low | **Build now** |
| Badges and donor journey (first donation, 5th donation, platelet donor, camp volunteer) | Very low | **Build now** |
| "Your donation was used" update, only when the centre confirms it | Very low | **Build now (manual by coordinator)** |
| Team / college / employer milestones (count of confirmed donations, no individual ranking) | Low | **Build now** |
| Recognition for non-donation contributions (referring donors, volunteering at camps) | Low | **Build now** |
| Token items handed out **by the blood centre or camp organiser** (refreshment / meal coupon) | Low, with approval | Feature-flagged; partner-run |
| Store coins / discount coupons from merchants | High | **Not built**; ask officials first |
| Cash, transferable points, priority access to blood for donors | Prohibited / unethical | **Never** |

## Rules if token rewards are ever enabled

1. Earned only from a donation **confirmed by a blood centre**, never from tapping "accept".
2. Not cash, not transferable, not sellable; no exchange rate shown.
3. Never given to requesters, and never linked to priority access to blood.
4. Annual cap per donor; items limited to the token list the approving authority allows.
5. Written approval stored in `docs/approvals/` before the flag is turned on.

## What to ask officials

- Which token items, if any, may a digital platform (not the blood centre) offer?
- Is there a value cap per donation or per year?
- Must items be handed over physically at the centre or camp?
- Is a digital certificate co-branded with the blood centre acceptable?