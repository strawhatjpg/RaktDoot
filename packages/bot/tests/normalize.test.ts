import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeBloodGroup, normalizeComponent, normalizeUnits } from "../src/ai/normalize.ts";
import { detectLanguage } from "../src/ai/detect-language.ts";

test("blood group: compact, spaced, Hindi, Marathi forms", () => {
  const cases: Array<[string, string | null]> = [
    ["B+", "B+"], ["b+ve", "B+"], ["O-ve", "O-"], ["0+", "O+"], ["AB negative", "AB-"],
    ["B positive ke 2 unit", "B+"], ["Papa ko o neg chahiye", "O-"],
    ["बी पॉजिटिव", "B+"], ["ओ नेगेटिव रक्त", "O-"], ["एबी पॉझिटिव्ह पाहिजे", "AB+"],
    ["A+ or B+", null], ["B group", null], ["", null], ["10-12 units", null],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeBloodGroup(input), expected, input);
});

test("component wording", () => {
  assert.equal(normalizeComponent("need SDP platelets"), "PLATELETS");
  assert.equal(normalizeComponent("प्लेटलेट्स चाहिए"), "PLATELETS");
  assert.equal(normalizeComponent("PRBC 2 unit"), "PACKED_RED_CELLS");
  assert.equal(normalizeComponent("FFP"), "PLASMA");
  assert.equal(normalizeComponent("WHOLE_BLOOD"), "WHOLE_BLOOD");
  assert.equal(normalizeComponent("blood chahiye"), null);
});

test("units: digits, Devanagari digits, words; out-of-range rejected", () => {
  assert.equal(normalizeUnits("2 unit"), 2);
  assert.equal(normalizeUnits("३ यूनिट"), 3);
  assert.equal(normalizeUnits("do unit chahiye"), 2);
  assert.equal(normalizeUnits("दोन"), 2);
  assert.equal(normalizeUnits(0), null);
  assert.equal(normalizeUnits(50), null);
});

test("language detection", () => {
  assert.equal(detectLanguage("Papa City Hospital mein admit hain, B positive ke 2 unit chahiye").language, "hi-Latn");
  assert.equal(detectLanguage("Need 2 units of B+ blood at City Hospital").language, "en");
  assert.equal(detectLanguage("मेरे पापा अस्पताल में भर्ती हैं, खून चाहिए").language, "hi");
  assert.equal(detectLanguage("माझ्या बाबांना रक्त पाहिजे, ते रुग्णालयात दाखल आहेत").language, "mr");
});