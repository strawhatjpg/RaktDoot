# User roles and trust model

## Short answer

**No, civilians are not limited to donating.** Any member of the public can raise a blood request. What changes is *what happens before private donors are contacted*.

| Action | Who can do it | Verification needed? |
|---|---|---|
| Raise a request (WhatsApp or app) | Anyone (family, friend, patient) | No |
| See nearby blood centres, stock labels, call / directions | Anyone | No (public information) |
| Track own request | The requester | No |
| Register as a donor, update location, set availability | Anyone 18+ | No (screening happens at the blood centre) |
| **Contact private donors (wave outreach)** | System, after verification | **Yes** |
| Verify a request | Hospital staff, blood centre staff, coordinator | Verified institutional or coordinator account |
| Confirm stock / confirm donation | Blood centre staff or coordinator | Yes |
| Close a request (any outcome) | Staff / coordinator | Yes; requesters may only **cancel** their own |

## Why verification sits before donor outreach

- Donors receive personal alerts. Fake or duplicate requests waste their time and break trust in the alerts.
- Requiring a nurse for every request would block families at night and in small towns.
- So the **family path is never blocked**: centre discovery is instant, and verification only gates contact with private donors.

## How a request gets verified

1. **Staff-raised request:** a nurse, hospital staff member or blood centre staff member logged in with a verified account raises it. It is verified automatically.
2. **Family-raised request:** it enters the coordinator queue as `PENDING_REVIEW`. A coordinator or the treating hospital confirms it (for example by calling the hospital's blood bank or ward). Then outreach starts.
3. **Partner hospital link (pilot):** the family selects the hospital; hospital staff receive a one-tap "confirm this patient request" message.

## Roles in code

Defined in [`packages/shared/src/constants.ts`](../packages/shared/src/constants.ts) as `USER_ROLES`; rules in [`lifecycle.ts`](../packages/shared/src/lifecycle.ts).

| Role | Description |
|---|---|
| `REQUESTER` | Member of the public raising a request |
| `DONOR` | Registered member of the public (a person can be both requester and donor) |
| `HOSPITAL_STAFF` | Verified nurse / doctor / hospital desk staff |
| `BLOOD_CENTRE_STAFF` | Verified staff of a licensed blood centre |
| `COORDINATOR` | NGO / platform volunteer running outreach |
| `ADMIN` | Platform operator; onboards staff accounts |

Staff accounts are created by an admin (seeded for the demo). Self-signup never grants a staff role.