# Coding standards

- TypeScript, `strict` mode. Shared domain logic lives in `packages/shared/src` and must stay framework-free.
- Use `as const` arrays + union types instead of TS `enum` (shared code runs via Node type stripping).
- Relative imports inside `packages/shared` include the `.ts` extension.
- Validate all external input (webhooks, API bodies, AI output) with schemas before use.
- Every new domain rule gets a `node:test` test in `packages/shared/tests`. Run `npm test` before committing.
- Never commit secrets. New config goes into `.env.example` with a safe placeholder.
- Python (forecast service): typed functions, pytest tests, no notebooks in the repo.
- After each meaningful step, append an entry to `docs/CLINE_USAGE.md`.