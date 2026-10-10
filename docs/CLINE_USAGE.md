# How Cline was used

A running log for the README, PPT and demo video. Add an entry after each meaningful step; keep screenshots in `docs/screenshots/`.

| # | Phase | What Cline did | Output |
|---|---|---|---|
| 1 | Ideation | Reviewed the blood donation idea, checked eRaktKosh and WhatsApp policies, proposed a coordination-first framing | Problem statement + feature shortlist |
| 2 | Ideation | Read the hackathon brief PDF, checked feasibility (WhatsApp location, opt-in, 24 h window, Cline SDK, donor gift rules) | Verified feature table, pipelines |
| 3 | Planning | Reworked plan per team decisions (manual location, in-chat consent, rewards policy, roles) | `docs/ROADMAP.md`, `USER_ROLES.md`, `REWARDS_POLICY.md` |
| 4 | Scaffold | Created repository, `.clinerules`, shared domain rules and 16 passing tests | `packages/shared` |

## Cline inside the product

Coordinator Copilot built with `@cline/sdk` custom tools (see `docs/PIPELINES.md` § F).