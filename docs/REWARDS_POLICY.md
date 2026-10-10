# Rewards policy (revised)

## Decision

The team chose to ship **RaktDoot coins** with a **sponsor coupon store** and **referral
rewards**, alongside the existing non-monetary recognition (certificates). The feature is
built and switched by `FEATURE_TOKEN_REWARDS` (off by default; on for the demo).

Because Indian blood-transfusion guidance defines voluntary donation as donation without
payment "in cash or kind", the design limits what coins can be and how they are earned.
**Before switching it on outside a demo, get written guidance** from the State Blood
Transfusion Council or a partner blood centre and store it in `docs/approvals/`.

## Context

- NBTC follows the WHO definition of voluntary non-remunerated donation (no payment in cash or kind that could substitute for money).
- Maharashtra SBTC (November 2024) banned substantial gifts to donors but allowed token items such as meal coupons, badges, T-shirts, mementos and refreshments ([report](https://indianexpress.com/article/cities/mumbai/sbtc-bans-substantial-gifts-incentives-ethos-voluntary-blood-donation-9671835/)).
- A store of high-value or cash-like rewards would look like payment for blood. Small sponsor tokens are closer to the allowed "token items".

## How coins are earned

| Event | Who | Coins | Rule |
|---|---|---:|---|
| Donation **confirmed by blood-centre staff or a coordinator** | Donor | 100 | Once per donation. Never for tapping Accept. |
| A person who joined through your link **registers as a donor** | Referrer | 25 | Once per referred person. Not for a bare install or sign-up. |
| That person's **first confirmed donation** | Referrer | 50 | Once per referred person. |

Referral safeguards: a code can be attached only to an account created within the last
24 hours, only once, never to yourself; at most 10 referral rewards per referrer per 30 days.

## How coins are spent

Sponsors (companies) supply coupon codes for small token items (coffee, pharmacy discount,
movie ticket). An admin adds them with `POST /api/admin/store-items`. Each code is handed to
exactly one person; each person can redeem an item a limited number of times (default 1).

## Hard rules (enforced in code)

1. Coins have no cash value, cannot be withdrawn, sold or transferred between users.
2. Coins never affect matching, alerts, verification or anyone's access to blood.
3. Requesters (patients' families) never earn coins for requesting blood.
4. Every coin movement is an append-only ledger entry with a unique reference, so awards are never paid twice and the balance always equals the ledger.
5. Redemption debits and claims a coupon in one transaction, so no one can overspend or receive a code already given to someone else.
6. "DELETE MY DATA" erases the wallet, ledger, referral links and issued codes.

## Still never allowed

Cash, transferable points, gift cards of significant value, or any priority access to
blood for donors or referrers.

## Questions for officials before a real launch

- Is a sponsor coupon after a confirmed donation acceptable as a "token item"? Is there a value cap per donation or per year?
- Are referral rewards acceptable at all, given that referring is not itself a donation?
- Must token items be handed over physically at the centre or camp instead of digitally?