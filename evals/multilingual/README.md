# Multilingual intake evals

`cases.jsonl` will hold ~50 realistic messages (Hindi, Hinglish, English, one regional language, typos, voice transcripts) with expected structured fields. `run-evals.ts` scores per-field accuracy and writes `results.md`, which is quoted in the main README.

Example case format:

```json
{"id":"hi-001","lang":"hi-Latn","input":"Papa City Hospital mein admit hain, B positive ke 2 unit chahiye","expected":{"bloodGroup":"B+","units":2,"component":"UNKNOWN","hospital":"City Hospital"}}
```