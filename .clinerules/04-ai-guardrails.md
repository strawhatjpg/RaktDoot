# AI guardrails

- AI is used for language: language detection, structured extraction, translation, transcription, summaries, drafts.
- AI never decides: clinical urgency, donor medical fitness, component substitution or compatibility, stock existence, or request verification.
- LLM extraction output must be schema-validated, then normalised by deterministic code (e.g. "B+ve" → `B+`). Uncertain fields trigger a follow-up question.
- Users confirm extracted details before a request opens.
- Safety-critical message text comes from reviewed i18n files, not live generation.
- Copilot (Cline SDK) tools may read data and create drafts. Sending messages, closing cases or editing records requires explicit human approval.
- Forecasts are shown as ranges with backtest error and a "synthetic data" label until real data exists.
- Measure multilingual accuracy with `evals/multilingual` and report the score in the README.