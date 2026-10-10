# Challenges log

Record problems as they happen; this feeds the PPT "challenges faced" slide.

| Challenge | Impact | Resolution |
|---|---|---|
| WhatsApp does not deliver continuous live location to bots | Live donor tracking not possible | Manual location updates with privacy-preserving storage |
| Donor incentive rules (no cash or substantial gifts) | Coin/coupon store risky | Non-monetary recognition; token rewards flagged off pending official guidance |
| Prescription slips cannot be authenticated by AI | Fake requests risk | Removed slip reading; staff verification gates donor outreach |
| JS `\b` word boundaries don't work for Devanagari, and rule parsers over-matched ("Kalyani" read as "kal" = tomorrow, "Wing A-2" read as A−) | Wrong deadlines / blood groups in requests | Unicode-aware whole-word matching, sign must not be followed by a digit, regression tests |
| Conversation dead-ends found in a debug pass (short replies like "2" ignored, "not sure" skipped required fields, first message lost during onboarding, LOCATION broke a half-finished request) | Users stuck in loops | Context-aware answers to the last question, required fields can't be skipped, pending first message reused, resume-after-location |