# Multilingual extraction results

Mode: **rules only (no AI)** · Cases: 32 · Run: 2026-10-10T10:07:40.002Z

| Field | Accuracy |
|---|---|
| bloodGroup | 100.0% (32/32) |
| component | 100.0% (32/32) |
| units | 100.0% (32/32) |
| hospital | 93.8% (30/32) |
| language | 100.0% (32/32) |
| **Overall** | **98.8%** |

Unsafe blood-group guesses (value given when the message did not state one): **0**

| Language | Field accuracy |
|---|---|
| en | 100.0% |
| hi-Latn | 96.7% |
| hi | 100.0% |
| mr | 100.0% |

## Failures

| Case | Field | Detail |
|---|---|---|
| voice-001 | hospital | expected ~ruby hall got null |
| typo-001 | hospital | expected ~ruby got null |
