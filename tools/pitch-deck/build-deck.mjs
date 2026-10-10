/**
 * Generates the RaktDoot pitch deck -> docs/RaktDoot_Pitch_Deck.pptx
 * Run: cd tools/pitch-deck && npm install && npm run build
 * Content comes from docs/ (README, PIPELINES, ROADMAP, USER_ROLES, SAFETY_PRIVACY,
 * REWARDS_POLICY, CHALLENGES). Statistics are cited on the final "Sources" slide.
 */
import pptxgen from "pptxgenjs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, "../../docs/RaktDoot_Pitch_Deck.pptx");

// ---------- Theme ----------
const C = {
  red: "C8102E", deep: "2B0A10", wine: "5A0F1C", cream: "FFF8F5", blush: "FBE4E6",
  gold: "F4A259", teal: "1F8A70", ink: "222222", grey: "5F5F5F", light: "E9E9E9", white: "FFFFFF",
};
const FONT = "Segoe UI";
const W = 13.333; // LAYOUT_WIDE width in inches

const pptx = new pptxgen();
pptx.layout = "LAYOUT_WIDE";
pptx.title = "RaktDoot - from blood request to confirmed response";
pptx.company = "Team RaktDoot";
pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };

let pageNo = 0;

// ---------- Helpers ----------
function base({ dark = false } = {}) {
  const s = pptx.addSlide();
  pageNo += 1;
  s.background = { color: dark ? C.deep : C.cream };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.18, h: 7.5, fill: { color: C.red }, line: { color: C.red } });
  s.addText("RaktDoot", { x: 0.45, y: 7.05, w: 3, h: 0.3, fontFace: FONT, fontSize: 10, bold: true, color: dark ? C.gold : C.red });
  s.addText(String(pageNo), { x: W - 1.0, y: 7.05, w: 0.6, h: 0.3, fontFace: FONT, fontSize: 10, align: "right", color: dark ? "BBBBBB" : C.grey });
  return s;
}

function header(s, kicker, title, { dark = false } = {}) {
  s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.35, w: 10, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: dark ? C.gold : C.red, charSpacing: 3 });
  s.addText(title, { x: 0.6, y: 0.7, w: 12.1, h: 0.85, fontFace: FONT, fontSize: 30, bold: true, color: dark ? C.white : C.deep });
}

function card(s, { x, y, w, h, fill = C.white, border = C.light, accent = C.red }) {
  s.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h, fill: { color: fill }, line: { color: border, width: 1 }, rectRadius: 0.12,
    shadow: { type: "outer", color: "000000", opacity: 0.12, blur: 6, offset: 2, angle: 90 },
  });
  if (accent) s.addShape(pptx.ShapeType.rect, { x: x + 0.15, y, w: w - 0.3, h: 0.07, fill: { color: accent }, line: { color: accent } });
}

function bullets(s, items, { x, y, w, h, size = 15, color = C.ink, bulletColor = C.red }) {
  s.addText(
    items.map((t) => ({ text: t, options: { bullet: { code: "25CF", color: bulletColor }, paraSpaceAfter: 6 } })),
    { x, y, w, h, fontFace: FONT, fontSize: size, color, valign: "top" },
  );
}

function iconCard(s, { x, y, w, h, icon, title, body, accent = C.red, size = 13 }) {
  card(s, { x, y, w, h, accent });
  s.addShape(pptx.ShapeType.ellipse, { x: x + 0.25, y: y + 0.3, w: 0.6, h: 0.6, fill: { color: accent }, line: { color: accent } });
  s.addText(icon, { x: x + 0.25, y: y + 0.3, w: 0.6, h: 0.6, fontSize: 18, align: "center", valign: "middle", color: C.white, bold: true, fontFace: FONT });
  s.addText(title, { x: x + 0.95, y: y + 0.28, w: w - 1.1, h: 0.65, fontFace: FONT, fontSize: 15, bold: true, color: C.deep, valign: "middle" });
  s.addText(body, { x: x + 0.25, y: y + 1.0, w: w - 0.45, h: h - 1.1, fontFace: FONT, fontSize: size, color: C.grey, valign: "top" });
}

function arrow(s, x, y, w, color = C.red) {
  s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color, width: 2.5, endArrowType: "triangle" } });
}

function pill(s, text, { x, y, w, h = 0.42, fill = C.red, color = C.white, size = 12 }) {
  s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill }, rectRadius: 0.2 });
  s.addText(text, { x, y, w, h, fontFace: FONT, fontSize: size, bold: true, color, align: "center", valign: "middle" });
}

function source(s, text, dark = false) {
  s.addText(text, { x: 0.6, y: 6.65, w: 12, h: 0.35, fontFace: FONT, fontSize: 9, italic: true, color: dark ? "AAAAAA" : C.grey });
}

/** Vector blood drop (custom geometry) with a glossy highlight. Coordinates are inches inside the shape box. */
function drop(s, { x, y, w, h, color = C.red, gloss = true }) {
  const pts = [
    { x: w / 2, y: 0 },
    { x: w, y: h * 0.64, curve: { type: "cubic", x1: w * 0.62, y1: h * 0.2, x2: w, y2: h * 0.42 } },
    { x: w / 2, y: h, curve: { type: "cubic", x1: w, y1: h * 0.86, x2: w * 0.79, y2: h } },
    { x: 0, y: h * 0.64, curve: { type: "cubic", x1: w * 0.21, y1: h, x2: 0, y2: h * 0.86 } },
    { x: w / 2, y: 0, curve: { type: "cubic", x1: 0, y1: h * 0.42, x2: w * 0.38, y2: h * 0.2 } },
    { close: true },
  ];
  s.addShape(pptx.ShapeType.custGeom, {
    x, y, w, h, points: pts, fill: { color }, line: { color, width: 0 },
    shadow: { type: "outer", color: "000000", opacity: 0.45, blur: 18, offset: 6, angle: 90 },
  });
  if (gloss) {
    s.addShape(pptx.ShapeType.ellipse, { x: x + w * 0.2, y: y + h * 0.5, w: w * 0.16, h: h * 0.26, rotate: 15, fill: { color: C.white, transparency: 70 }, line: { color: C.white, transparency: 100 } });
    s.addShape(pptx.ShapeType.ellipse, { x: x + w * 0.24, y: y + h * 0.8, w: w * 0.07, h: w * 0.07, fill: { color: C.white, transparency: 60 }, line: { color: C.white, transparency: 100 } });
  }
}

/** Heartbeat (ECG) polyline. pts are [x, y] inches relative to (x, y). */
function ecg(s, { x, y, w, h, pts, color = C.white, width = 2.5, transparency = 0 }) {
  s.addShape(pptx.ShapeType.custGeom, {
    x, y, w, h,
    points: pts.map(([px, py], i) => (i === 0 ? { x: px, y: py, moveTo: true } : { x: px, y: py })),
    line: { color, width, transparency },
  });
}

/** Straight connector with an arrow head. Use w=0 for vertical, h=0 for horizontal. */
function link(s, x, y, w, h, color = C.grey, both = false) {
  s.addShape(pptx.ShapeType.line, {
    x, y, w, h,
    line: { color, width: 1.75, endArrowType: "triangle", ...(both ? { beginArrowType: "triangle" } : {}) },
  });
}

// ============================ SLIDES ============================

// ---- 1. Title ----
{
  const s = base({ dark: true });
  // glow rings behind the drop
  const cx = 10.45, cy = 3.85;
  [[6.4, 88], [5.0, 80], [3.8, 68]].forEach(([d, t]) => {
    s.addShape(pptx.ShapeType.ellipse, { x: cx - d / 2, y: cy - d / 2, w: d, h: d, fill: { color: C.red, transparency: t }, line: { color: C.red, transparency: 100 } });
  });
  s.addShape(pptx.ShapeType.ellipse, { x: cx - 2.75, y: cy - 2.75, w: 5.5, h: 5.5, line: { color: C.gold, width: 0.75, transparency: 55, dashType: "dash" } });
  drop(s, { x: cx - 1.45, y: 1.55, w: 2.9, h: 3.9, color: C.red });
  // heartbeat line running through the drop
  ecg(s, {
    x: 7.9, y: 3.15, w: 5.43, h: 1.6, color: C.white, width: 3,
    pts: [[0, 0.95], [1.0, 0.95], [1.25, 0.7], [1.5, 0.95], [2.05, 0.95], [2.25, 1.45], [2.55, 0.0], [2.85, 1.6], [3.1, 0.95], [3.6, 0.95], [3.85, 0.7], [4.1, 0.95], [5.43, 0.95]],
  });
  // left: brand + hook
  s.addText("CLINE AI BUILDER HACKATHON  ·  ROUND 2", { x: 0.7, y: 0.75, w: 7, h: 0.35, fontFace: FONT, fontSize: 12, bold: true, color: C.gold, charSpacing: 3 });
  s.addText([
    { text: "Rakt", options: { color: C.white } },
    { text: "Doot", options: { color: C.red } },
  ], { x: 0.62, y: 1.2, w: 7, h: 1.35, fontFace: FONT, fontSize: 80, bold: true });
  s.addText("रक्तदूत  —  the messenger of blood", { x: 0.7, y: 2.5, w: 7, h: 0.45, fontFace: FONT, fontSize: 18, color: C.gold });
  s.addText("Right blood. Right place. Right time.", { x: 0.7, y: 3.2, w: 7, h: 0.6, fontFace: FONT, fontSize: 28, bold: true, color: C.white });
  s.addText("An AI-powered coordination layer that connects families, donors and licensed blood centres, from request to confirmed donation.", { x: 0.7, y: 3.8, w: 6.6, h: 0.8, fontFace: FONT, fontSize: 15, color: "CCCCCC" });
  // mini stat strip
  const stats = [["1.46 Cr", "units needed / year"], ["17.4 L", "units discarded in 2025"], ["~10%", "districts with no blood centre"]];
  stats.forEach(([n, l], i) => {
    const x = 0.7 + i * 2.25;
    if (i > 0) s.addShape(pptx.ShapeType.line, { x: x - 0.15, y: 4.85, w: 0, h: 0.95, line: { color: "6E3540", width: 1 } });
    s.addText(n, { x, y: 4.78, w: 2.1, h: 0.55, fontFace: FONT, fontSize: 26, bold: true, color: i === 1 ? C.gold : C.red });
    s.addText(l, { x, y: 5.3, w: 2.1, h: 0.5, fontFace: FONT, fontSize: 11, color: "BBBBBB", valign: "top" });
  });
  pill(s, "📱 App for requests", { x: 0.7, y: 6.15, w: 2.05, h: 0.4, fill: C.red, size: 11 });
  pill(s, "💬 WhatsApp for donors", { x: 2.85, y: 6.15, w: 2.3, h: 0.4, fill: C.teal, size: 11 });
  pill(s, "🤖 AI + human-verified", { x: 5.25, y: 6.15, w: 2.25, h: 0.4, fill: C.gold, color: C.deep, size: 11 });
  s.addNotes("RaktDoot means 'messenger of blood'. Hook: India collects record blood, yet lakhs of units expire while families scramble. Families request in the RaktDoot app; donors are reached on WhatsApp, where they already are; staff verify and close every case.");
}

// ---- 2. Big numbers ----
{
  const s = base({ dark: true });
  header(s, "The scale of the crisis", "India collects record blood — yet patients still wait", { dark: true });
  const stats = [
    ["1.46 Cr", "units of blood India needs every year", C.red],
    ["17.4 L", "blood components DISCARDED in 2025 — expiry was the #1 reason", C.gold],
    ["~10%", "of districts still have no functional blood centre", C.red],
    ["39%", "of people in 8 northern states can't reach a blood-equipped facility within 1 hour", C.gold],
    ["1.7 L+", "road-crash deaths a year — trauma care runs on blood", C.red],
    ["38%", "of maternal deaths in India caused by haemorrhage, the leading cause", C.gold],
  ];
  const cw = 3.85, ch = 2.3, gx = 0.3, gy = 0.25, x0 = 0.6, y0 = 1.75;
  stats.forEach(([num, label, col], i) => {
    const x = x0 + (i % 3) * (cw + gx);
    const y = y0 + Math.floor(i / 3) * (ch + gy);
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: C.wine }, line: { color: col, width: 1.5 }, rectRadius: 0.12 });
    s.addText(num, { x: x + 0.2, y: y + 0.12, w: cw - 0.4, h: 1.1, fontFace: FONT, fontSize: 52, bold: true, color: col });
    s.addText(label, { x: x + 0.2, y: y + 1.25, w: cw - 0.4, h: 0.95, fontFace: FONT, fontSize: 14, color: C.white, valign: "top" });
  });
  source(s, "Sources: Govt. in Parliament (2025); Rajya Sabha data via TOI (Aug 2026); MoHFW review (Apr 2026); BMJ Global Health (2024); MoRTH Road Accidents in India; Million Death Study, PLOS One (2014). See Sources slide.", true);
  s.addNotes("The paradox: India now collects about 1.58 crore units, more than the estimated 1.46 crore it needs, yet 17.4 lakh components were thrown away in 2025, mostly because they expired. 1 in 10 districts has no blood centre, and in the north almost 4 in 10 people can't reach blood within the golden hour. Accident victims and mothers with haemorrhage pay the price. The gap isn't only supply. It's getting the right unit to the right patient at the right time.\n\nBEFORE PRESENTING: re-check the road-death figure against the latest MoRTH report (2023 report: ~1.73 lakh) and the 38% maternal haemorrhage share (Million Death Study, 2001-03 data).");
}

// ---- 3. Government infrastructure gaps ----
{
  const s = base();
  header(s, "Where the system breaks", "Gaps in public blood infrastructure");
  const gaps = [
    ["🏥", "Uneven coverage", "~10% of districts lack a functional blood centre; the target of one per district is only due Dec 2026. Govt hospital centres are ~29% of ~4,260 centres."],
    ["📡", "Stock data isn't real-time", "Many centres are still not integrated with eRaktKosh / BBMS, so the availability families see online is often stale or missing."],
    ["🗑️", "Collected ≠ delivered", "1.58 Cr units collected in 2025, yet 17.4 L components discarded. Supply sits in the wrong place at the wrong time."],
    ["🟡", "Platelet & component gaps", "Platelet supply meets only ~77.5% of demand; component separation is limited outside big cities. Dengue season hits hardest."],
    ["📞", "No coordination layer", "Portals list centres, but nobody runs the last mile: calling donors, tracking who's coming, telling others to stand down."],
    ["🗣️", "Built for English & forms", "Official portals assume English and long forms, not a frightened family at 3 AM who just needs one simple screen."],
  ];
  const cw = 3.95, ch = 2.3;
  gaps.forEach(([ic, t, b], i) => {
    const x = 0.6 + (i % 3) * (cw + 0.13);
    const y = 1.7 + Math.floor(i / 3) * (ch + 0.25);
    iconCard(s, { x, y, w: cw, h: ch, icon: ic, title: t, body: b, accent: i % 2 ? C.wine : C.red, size: 12 });
  });
  source(s, "Sources: MoHFW/NACO review via Outlook India (Apr 2026); Rajya Sabha data via TOI (Aug 2026); ISBT Transfusion Today (Jul 2025).");
  s.addNotes("Be fair: eRaktKosh exists and collection is at a record high. But the ministry itself flagged that many centres don't update eRaktKosh in real time. It also told Parliament it had received no reports of regional shortages, which points to a reporting gap. What's missing is a coordination layer between the portal and the patient.");
}

// ---- 4. Problem: family journey ----
{
  const s = base();
  header(s, "The problem we address", "What a family goes through when blood is needed today");
  const steps = [
    ["1", "Doctor says \"arrange 2 units B+\"", "Family panics, often at night"],
    ["2", "Dozens of phone calls", "Fragmented listings, stock info hours old"],
    ["3", "Forwarded WhatsApp appeals", "Stale donor lists; numbers exposed publicly"],
    ["4", "Appeals never stop", "Keep circulating after the need is met"],
    ["5", "Nobody closes the loop", "No one knows who's coming or if it worked"],
  ];
  const bw = 2.25;
  steps.forEach(([n, t, b], i) => {
    const x = 0.6 + i * (bw + 0.21);
    card(s, { x, y: 1.9, w: bw, h: 2.6, accent: C.red });
    s.addText(n, { x, y: 2.05, w: bw, h: 0.6, fontSize: 30, bold: true, color: C.red, align: "center", fontFace: FONT });
    s.addText(t, { x: x + 0.1, y: 2.7, w: bw - 0.2, h: 0.95, fontSize: 14, bold: true, color: C.deep, align: "center", valign: "middle", fontFace: FONT });
    s.addText(b, { x: x + 0.1, y: 3.65, w: bw - 0.2, h: 0.75, fontSize: 12, color: C.grey, align: "center", fontFace: FONT });
    if (i < steps.length - 1) arrow(s, x + bw + 0.01, 3.2, 0.19);
  });
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 4.95, w: 12.1, h: 1.5, fill: { color: C.blush }, line: { color: C.red, width: 1 }, rectRadius: 0.12 });
  s.addText([
    { text: "Root cause: ", options: { bold: true, color: C.red } },
    { text: "the problem isn't only a shortage of blood. It's a shortage of ", options: { color: C.ink } },
    { text: "coordination", options: { bold: true, color: C.red } },
    { text: ". Information is stale, outreach is uncontrolled, donors burn out from spam, and no one confirms the outcome.", options: { color: C.ink } },
  ], { x: 0.85, y: 5.0, w: 11.6, h: 1.4, fontFace: FONT, fontSize: 17, valign: "middle" });
  s.addNotes("Walk through the 3 AM story. Each step is a real failure: stale info, spam appeals, donor fatigue, no closure. End on the root cause: coordination, not just supply.");
}

// ---- 5. Vision ----
{
  const s = base({ dark: true });
  s.addText("OUR VISION", { x: 0.7, y: 1.1, w: 12, h: 0.5, fontFace: FONT, fontSize: 16, bold: true, color: C.gold, charSpacing: 4 });
  s.addText("No family in India should have to make 50 phone calls to find blood.", { x: 0.7, y: 1.7, w: 11.8, h: 1.8, fontFace: FONT, fontSize: 40, bold: true, color: C.white });
  s.addText("Every request, in any language, becomes a verified, tracked case that ends at a licensed blood centre with a confirmed outcome.", { x: 0.7, y: 3.6, w: 11.5, h: 1.0, fontFace: FONT, fontSize: 20, color: "DDDDDD" });
  [["Accessible", "Simple app, any Indian language, voice"], ["Trustworthy", "Verified requests, honest stock labels"], ["Respectful", "Donor consent, privacy, no spam"]].forEach(([t, b], i) => {
    const x = 0.7 + i * 4.05;
    s.addShape(pptx.ShapeType.roundRect, { x, y: 5.0, w: 3.8, h: 1.3, fill: { color: C.wine }, line: { color: C.gold, width: 1 }, rectRadius: 0.1 });
    s.addText(t, { x: x + 0.2, y: 5.08, w: 3.4, h: 0.5, fontFace: FONT, fontSize: 18, bold: true, color: C.gold });
    s.addText(b, { x: x + 0.2, y: 5.6, w: 3.4, h: 0.6, fontFace: FONT, fontSize: 14, color: C.white });
  });
  s.addNotes("Vision statement. Pause after the headline. Three principles guide every design decision: accessible, trustworthy, respectful.");
}

// ---- 6. Solution at a glance ----
{
  const s = base();
  header(s, "Our solution", "One coordination layer for patient, donor & blood centre");
  s.addText("We don't replace eRaktKosh. We add the missing last mile on top of it.", { x: 0.6, y: 1.5, w: 12, h: 0.45, fontFace: FONT, fontSize: 16, italic: true, color: C.grey });
  const cols = [
    ["📱", "Families · App", C.red, ["Raise a request in the RaktDoot app in seconds", "Type or speak in your own language", "Nearby centres + live stock shown instantly", "Live tracking of the case"]],
    ["💬", "Donors · WhatsApp", C.teal, ["Alerts arrive on WhatsApp, no app needed", "Only for verified, nearby needs", "Accept + ETA with one tap", "Consent, reminders, badges in-chat"]],
    ["🏥", "Staff & coordinators", C.wine, ["Verify requests from a dashboard", "Explainable donor ranking", "Run waves, confirm donation, close case", "AI Copilot briefings (human-approved)"]],
  ];
  cols.forEach(([ic, t, col, items], i) => {
    const x = 0.6 + i * 4.1;
    card(s, { x, y: 2.15, w: 3.9, h: 4.35, accent: col });
    s.addShape(pptx.ShapeType.ellipse, { x: x + 0.3, y: 2.45, w: 0.8, h: 0.8, fill: { color: col }, line: { color: col } });
    s.addText(ic, { x: x + 0.3, y: 2.45, w: 0.8, h: 0.8, fontSize: 24, align: "center", valign: "middle" });
    s.addText(t, { x: x + 1.25, y: 2.45, w: 2.5, h: 0.8, fontFace: FONT, fontSize: 20, bold: true, color: C.deep, valign: "middle" });
    bullets(s, items, { x: x + 0.25, y: 3.5, w: 3.45, h: 2.9, size: 14, bulletColor: col });
  });
  s.addNotes("One backend, three audiences, each on the channel that suits them: families request through the RaktDoot app, donors are reached on WhatsApp where they already are, and staff use a web dashboard. Every donation ends at a licensed blood centre.");
}

// ---- 7. Unique approach ----
{
  const s = base({ dark: true });
  header(s, "What makes us different", "Our unique approach", { dark: true });
  const items = [
    ["01", "Right channel for each user", "Families get a simple app to request in their own language. Donors are reached on WhatsApp, with no extra app to install."],
    ["02", "Blood-centre-first discovery", "Show licensed centres + stock labelled reported / confirmed / reserved with \"updated X min ago\" BEFORE asking donors."],
    ["03", "Verification gates donor outreach", "Anyone can request instantly, but private donors are contacted only after hospital / centre / coordinator verification."],
    ["04", "Wave outreach + stand-down", "Small ranked batches (5 → 10 → partners). Stand-down messages go out once the need is met. No spam."],
    ["05", "Closed loop, staff-confirmed", "A donor tapping \"accept\" is not success. Only the blood centre confirms the donation; staff close the case with a real outcome."],
    ["06", "AI for language, humans decide", "AI extracts and translates; it never makes clinical calls. A person approves every Copilot action."],
  ];
  items.forEach(([n, t, b], i) => {
    const x = 0.6 + (i % 2) * 6.15;
    const y = 1.7 + Math.floor(i / 2) * 1.62;
    s.addShape(pptx.ShapeType.roundRect, { x, y, w: 5.95, h: 1.45, fill: { color: C.wine }, line: { color: C.wine }, rectRadius: 0.1 });
    s.addText(n, { x: x + 0.15, y, w: 1.0, h: 1.45, fontFace: FONT, fontSize: 34, bold: true, color: C.gold, valign: "middle" });
    s.addText(t, { x: x + 1.15, y: y + 0.1, w: 4.65, h: 0.45, fontFace: FONT, fontSize: 16, bold: true, color: C.white });
    s.addText(b, { x: x + 1.15, y: y + 0.55, w: 4.65, h: 0.85, fontFace: FONT, fontSize: 12, color: "E0E0E0", valign: "top" });
  });
  s.addNotes("This is the core of the pitch. Spend time here. Six design choices, each a deliberate answer to a failure in the current system. Points 3 and 5 build trust; points 1 and 6 make it accessible.");
}

// ---- 8. Benefits ----
{
  const s = base();
  header(s, "Why it matters", "Benefits of our approach");
  const rows = [
    ["Today", "With RaktDoot"],
    ["50+ calls, forwarded appeals", "One request in the app, in your own language"],
    ["Stock info hours old or missing", "Freshness-labelled stock, centres shown instantly"],
    ["Fake / duplicate appeals waste donors' time", "Verified requests only reach private donors"],
    ["Donors spammed, burn out, drop off", "Small ranked waves, stand-downs, consent per purpose"],
    ["Appeals live forever; no outcome known", "Closed-loop case with staff-confirmed outcome"],
    ["Donor numbers posted publicly", "Contact shared only with per-request consent"],
    ["Shortages discovered too late", "Weekly demand forecasts → early, targeted campaigns"],
  ];
  const tbl = rows.map((r, i) => r.map((t, j) => ({
    text: (i === 0 ? "" : j === 0 ? "✗  " : "✓  ") + t,
    options: {
      bold: i === 0, fontSize: i === 0 ? 15 : 13, fontFace: FONT,
      color: i === 0 ? C.white : j === 0 ? C.grey : C.deep,
      fill: { color: i === 0 ? (j === 0 ? C.grey : C.red) : i % 2 ? C.white : C.blush },
      valign: "middle",
    },
  })));
  s.addTable(tbl, { x: 0.6, y: 1.7, w: 12.1, colW: [5.5, 6.6], rowH: 0.56, border: { type: "solid", color: C.light, pt: 1 } });
  s.addNotes("Read the right column only. Benefits for families (speed, language), donors (respect, no spam, privacy) and the system (fewer wasted units through forecasting).");
}

// ---- 9. How it works: end-to-end flow ----
{
  const s = base();
  header(s, "How it works", "From one request to a confirmed donation");
  const flow = [
    ["📱", "Request", "Family raises it in the RaktDoot app: tap, type or speak", C.red],
    ["🤖", "AI intake", "Extracts group, component, units, hospital → confirm card", C.red],
    ["📍", "Centres", "Nearby licensed centres + stock freshness, instantly", C.teal],
    ["✅", "Verify", "Hospital / centre / coordinator confirms request", C.teal],
    ["🎯", "Match", "Filter + explainable ranking of consenting donors", C.wine],
    ["💬", "WhatsApp waves", "Donors alerted on WhatsApp: top 5 → next 10 → partners", C.wine],
    ["🏁", "Close", "Centre confirms donation → badge → case FULFILLED", C.gold],
  ];
  const bw = 1.62;
  flow.forEach(([ic, t, b, col], i) => {
    const x = 0.6 + i * (bw + 0.13);
    s.addShape(pptx.ShapeType.ellipse, { x: x + bw / 2 - 0.5, y: 1.8, w: 1.0, h: 1.0, fill: { color: col }, line: { color: col } });
    s.addText(ic, { x: x + bw / 2 - 0.5, y: 1.8, w: 1.0, h: 1.0, fontSize: 26, align: "center", valign: "middle" });
    if (i < flow.length - 1) arrow(s, x + bw / 2 + 0.55, 2.3, bw - 0.97, C.grey);
    s.addText(t, { x, y: 2.95, w: bw, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: C.deep, align: "center" });
    s.addText(b, { x, y: 3.35, w: bw, h: 1.2, fontFace: FONT, fontSize: 11, color: C.grey, align: "center", valign: "top" });
  });
  // three supporting cards: multilingual, never blocked, fallbacks
  const notes = [
    ["🌐 Multilingual by design", C.red, "Hindi, English, Hinglish + regional languages, typed or by voice. AI turns \"B+ve\" or \"बी पॉजिटिव\" into B+, asks follow-ups in the user's language, and shows a confirm card before anything opens."],
    ["⚡ The family is never blocked", C.teal, "Centre discovery is instant and needs no verification. If a centre confirms stock, the case goes straight to STOCK_CONFIRMED and no donors are disturbed."],
    ["🔁 Real-world fallbacks", C.wine, "Donor drops out, is deferred at screening, or more units are needed → back to outreach automatically. Staff can reopen closed cases."],
  ];
  notes.forEach(([t, col, b], i) => {
    const x = 0.6 + i * 4.08;
    card(s, { x, y: 4.65, w: 3.92, h: 1.95, accent: col });
    s.addText(t, { x: x + 0.2, y: 4.8, w: 3.6, h: 0.4, fontFace: FONT, fontSize: 14, bold: true, color: col });
    s.addText(b, { x: x + 0.2, y: 5.2, w: 3.6, h: 1.3, fontFace: FONT, fontSize: 11, color: C.grey, valign: "top" });
  });
  s.addNotes("This is the request lifecycle in packages/shared/src/lifecycle.ts, already implemented and unit-tested. DRAFT → AWAITING_CONFIRMATION → OPEN → CENTRES_LISTED → STOCK_CONFIRMED | OUTREACH_ACTIVE → DONOR_ACCEPTED → DONOR_ARRIVED → DONATION_CONFIRMED → CLOSED.\n\nMultilingual: the AI only handles language (detect, transcribe, extract, normalise, translate). Safety-critical replies come from reviewed translation strings, and accuracy is measured per field with the evals/multilingual set.");
}

// ---- 11. Smart matching + wave outreach ----
{
  const s = base();
  header(s, "Key feature", "Explainable donor matching + wave outreach");
  card(s, { x: 0.6, y: 1.7, w: 3.9, h: 4.8, accent: C.wine });
  s.addText("1 · Hard filters", { x: 0.85, y: 1.85, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.wine });
  bullets(s, [
    "Consented to urgent alerts",
    "Marked available",
    "Location set (~1 km precision)",
    "Within their travel radius",
    "Past provisional interval (90 days M / 120 days F)",
    "Not committed to another case",
  ], { x: 0.85, y: 2.35, w: 3.5, h: 4.0, size: 13, bulletColor: C.wine });
  card(s, { x: 4.7, y: 1.7, w: 3.9, h: 4.8, accent: C.red });
  s.addText("2 · Explainable ranking", { x: 4.95, y: 1.85, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.red });
  [["Availability freshness", 0.35], ["Distance", 0.30], ["Recent alert load", 0.20], ["Stated arrival time", 0.15]].forEach(([t, v], i) => {
    const y = 2.45 + i * 0.85;
    s.addText(`${t}  ·  ${Math.round(v * 100)}%`, { x: 4.95, y, w: 3.5, h: 0.35, fontFace: FONT, fontSize: 12, color: C.ink });
    s.addShape(pptx.ShapeType.rect, { x: 4.95, y: y + 0.38, w: 3.4, h: 0.22, fill: { color: C.light }, line: { color: C.light } });
    s.addShape(pptx.ShapeType.rect, { x: 4.95, y: y + 0.38, w: (3.4 * v) / 0.35, h: 0.22, fill: { color: C.red }, line: { color: C.red } });
  });
  s.addText("Every score comes with reasons shown to the coordinator.", { x: 4.95, y: 5.85, w: 3.5, h: 0.5, fontFace: FONT, fontSize: 11, italic: true, color: C.grey });
  card(s, { x: 8.8, y: 1.7, w: 3.9, h: 4.8, accent: C.teal });
  s.addText("3 · Waves, not blasts", { x: 9.05, y: 1.85, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.teal });
  [["Wave 1", "Top 5 donors", 1.4], ["Wave 2", "Wider radius, next 10", 1.8], ["Wave 3", "Partner NGOs + coordinator", 2.2]].forEach(([t, b, w], i) => {
    const y = 2.45 + i * 0.95;
    s.addShape(pptx.ShapeType.roundRect, { x: 9.05, y, w, h: 0.75, fill: { color: C.teal }, line: { color: C.teal }, rectRadius: 0.1 });
    s.addText(t, { x: 9.05, y, w, h: 0.75, fontFace: FONT, fontSize: 12, bold: true, color: C.white, align: "center", valign: "middle" });
    s.addText(b, { x: 9.1 + w, y, w: 3.45 - w, h: 0.75, fontFace: FONT, fontSize: 11, color: C.grey, valign: "middle" });
  });
  s.addText("Donor buttons: [Accept + ETA] [Decline] [Pause alerts]\nEnough accepted → stand-down to everyone else.", { x: 9.05, y: 5.3, w: 3.5, h: 1.0, fontFace: FONT, fontSize: 11, color: C.ink });
  s.addNotes("Matching uses rules, not a black box. Weights from docs/PIPELINES.md. Waves protect donors from fatigue; stand-down messages stop appeals once the need is met.");
}

// ---- 12. AI pillar 2 + Copilot ----
{
  const s = base();
  header(s, "AI pillar 2 + Cline inside the product", "Predict shortages early, act with a human-approved Copilot");
  card(s, { x: 0.6, y: 1.7, w: 6.0, h: 4.8, accent: C.gold });
  s.addText("📈 Area demand forecasting", { x: 0.85, y: 1.85, w: 5.6, h: 0.45, fontFace: FONT, fontSize: 17, bold: true, color: C.deep });
  bullets(s, [
    "Weekly demand ranges per district × blood group × component",
    "Gradient boosting with quantile loss → P10 / P50 / P90 ranges",
    "Features: lags, rolling means, week of year, festival flag, stock trend",
    "Captures dengue platelet surge, summer donation dip, festivals",
    "Rolling backtest vs seasonal-naive baseline; error shown on dashboard",
    "Labelled \"synthetic data\" until real data is available",
  ], { x: 0.85, y: 2.4, w: 5.6, h: 4.0, size: 13, bulletColor: C.gold });
  card(s, { x: 6.8, y: 1.7, w: 5.9, h: 4.8, accent: C.teal });
  s.addText("🧑‍✈️ Coordinator Copilot (Cline SDK)", { x: 7.05, y: 1.85, w: 5.5, h: 0.45, fontFace: FONT, fontSize: 17, bold: true, color: C.deep });
  s.addText("\"Which requests are at risk today?\"", { x: 7.05, y: 2.35, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 13, italic: true, color: C.teal });
  ["get_open_requests", "search_blood_centres", "rank_donors", "get_forecast", "summarize_case", "draft_outreach_message"].forEach((t, i) => {
    pill(s, t, { x: 7.05 + (i % 2) * 2.75, y: 2.9 + Math.floor(i / 2) * 0.55, w: 2.6, h: 0.42, fill: C.blush, color: C.wine, size: 11 });
  });
  s.addText("→ briefing + suggested actions + drafted campaign", { x: 7.05, y: 4.6, w: 5.5, h: 0.4, fontFace: FONT, fontSize: 13, color: C.ink });
  s.addShape(pptx.ShapeType.roundRect, { x: 7.05, y: 5.15, w: 5.4, h: 1.1, fill: { color: C.teal }, line: { color: C.teal }, rectRadius: 0.1 });
  s.addText("🔒 Human in the loop: sending, closing or editing ALWAYS needs explicit coordinator approval.", { x: 7.2, y: 5.15, w: 5.1, h: 1.1, fontFace: FONT, fontSize: 13, bold: true, color: C.white, valign: "middle" });
  s.addNotes("Forecast → Copilot briefing → proposed campaign → coordinator approves → opted-in eligible donors. Cline was used to build the project AND runs inside the product through the Cline SDK.");
}

// ---- 13. Trust, safety & privacy ----
{
  const s = base();
  header(s, "Built responsibly", "Trust, safety & privacy by design");
  const items = [
    ["🏥", "Licensed centres only", "No person-to-person collection. Every donor goes to a licensed blood centre with the request ID.", C.red],
    ["🩺", "AI never makes clinical calls", "No decisions on urgency, fitness, compatibility or substitution. The blood centre's screening decides.", C.wine],
    ["✋", "Consent for each purpose", "Separate in-chat buttons: alerts · reminders · location · contact sharing. \"STOP\" withdraws anytime.", C.teal],
    ["📍", "Privacy-preserving location", "Manual updates only, stored at ~1 km. No live tracking, no Aadhaar, minimal medical data.", C.teal],
    ["🛡️", "Abuse protection", "Verification gate, rate limits, duplicate detection, report / block, no payment features.", C.wine],
    ["🎖️", "Ethical recognition", "Certificates and badges, not cash or coins. Token rewards stay OFF until official guidance arrives.", C.red],
  ];
  const cw = 3.95, ch = 2.3;
  items.forEach(([ic, t, b, col], i) => {
    const x = 0.6 + (i % 3) * (cw + 0.13);
    const y = 1.7 + Math.floor(i / 3) * (ch + 0.25);
    iconCard(s, { x, y, w: cw, h: ch, icon: ic, title: t, body: b, accent: col, size: 12 });
  });
  source(s, "Designed with India's DPDP Act 2023 and NBTC voluntary-donation norms in mind (not legal advice). \"DELETE MY DATA\" erases the profile.");
  s.addNotes("Judges and partners need to trust this. Every point here is a written policy in docs/SAFETY_PRIVACY.md and docs/REWARDS_POLICY.md, and several are enforced in code (verification gate, closer roles).");
}

// ---- 14. Architecture & tech stack ----
{
  const s = base({ dark: true });
  header(s, "Under the hood", "Cloud-native, API-first, event-driven architecture", { dark: true });
  const node = (x, y, w, h, title, sub, col, { fill = C.wine, size = 13 } = {}) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: col, width: 1.5 }, rectRadius: 0.1 });
    s.addText([
      { text: title, options: { bold: true, color: C.white, fontSize: size, breakLine: !!sub } },
      ...(sub ? [{ text: sub, options: { color: "D8C3C6", fontSize: 10 } }] : []),
    ], { x: x + 0.08, y, w: w - 0.16, h, fontFace: FONT, align: "center", valign: "middle" });
  };
  const tag = (x, y, t) => s.addText(t, { x, y, w: 2.9, h: 0.28, fontFace: FONT, fontSize: 9, bold: true, color: C.gold, charSpacing: 2 });

  tag(0.6, 1.62, "EXPERIENCE LAYER");
  node(0.6, 1.95, 2.35, 1.0, "📱 RaktDoot App", "Families · PWA · Web Push", C.red);
  node(0.6, 3.15, 2.35, 1.0, "💬 WhatsApp Cloud API", "Donors · webhooks · buttons", C.teal);
  node(0.6, 4.35, 2.35, 1.0, "🖥️ Staff Console", "Hospitals · centres · NGOs", C.gold);

  tag(3.4, 1.62, "SECURE API GATEWAY");
  node(3.4, 1.95, 1.85, 3.4, "🔐 Next.js API layer", "Auth · RBAC\nschema validation\nrate limiting\nsigned webhooks", C.red, { fill: "3D0A14", size: 14 });

  tag(5.7, 1.62, "CORE DOMAIN SERVICES");
  const svc = [["🧠 AI Intake", "NLP · speech-to-text"], ["📍 Geo Discovery", "centres · stock freshness"], ["✅ Verification", "trust & safety gate"], ["🎯 Smart Matching", "explainable scoring"], ["📣 Outreach Engine", "waves · stand-down"], ["🔄 Case Lifecycle", "state machine · audit"]];
  svc.forEach(([t, b], i) => {
    const x = 5.7 + (i % 2) * 1.98, y = 1.95 + Math.floor(i / 2) * 1.17;
    node(x, y, 1.88, 1.05, t, b, i % 2 ? C.teal : C.red, { size: 12 });
  });

  tag(9.85, 1.62, "INTELLIGENCE LAYER");
  node(9.85, 1.95, 2.85, 0.98, "🤖 GenAI layer", "Gemini + Groq (Whisper) · auto-failover", C.gold, { size: 12 });
  node(9.85, 3.06, 2.85, 0.98, "📈 Predictive ML service", "FastAPI · scikit-learn · P10–P90", C.gold, { size: 12 });
  node(9.85, 4.17, 2.85, 0.98, "🧑‍✈️ Agentic Copilot", "Cline SDK · tool-calling · human-in-loop", C.gold, { size: 12 });

  [2.45, 3.65, 4.85].forEach((y) => link(s, 2.98, y, 0.39, 0, C.gold));
  link(s, 5.27, 3.65, 0.4, 0, C.gold, true);
  [2.44, 3.55, 4.66].forEach((y) => link(s, 9.6, y, 0.22, 0, C.gold, true));

  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 5.6, w: 12.1, h: 0.95, fill: { color: "3D0A14" }, line: { color: "6E3540", width: 1 }, rectRadius: 0.1 });
  const rail = [["🗄️ Prisma ORM", "SQLite → PostgreSQL"], ["⏱️ Async worker", "wave timers · reminders · cron"], ["📦 Shared domain core", "TypeScript · unit-tested"], ["🛡️ Privacy by design", "consent ledger · audit log"], ["☁️ Zero-cost cloud", "Render / Railway free tier"]];
  rail.forEach(([t, b], i) => {
    const x = 0.75 + i * 2.4;
    s.addText([{ text: t, options: { bold: true, color: C.white, fontSize: 12, breakLine: true } }, { text: b, options: { color: "D8C3C6", fontSize: 10 } }], { x, y: 5.6, w: 2.3, h: 0.95, fontFace: FONT, align: "center", valign: "middle" });
    if (i > 0) s.addShape(pptx.ShapeType.line, { x: x - 0.05, y: 5.75, w: 0, h: 0.65, line: { color: "6E3540", width: 1 } });
  });
  s.addNotes("Read left to right. Three experience channels, one for each user: the app for families, WhatsApp for donors, a console for staff. They all hit one secure API layer (auth, role-based access, validation, rate limits, signed WhatsApp webhooks). Behind it sit the core domain services, which call the intelligence layer: GenAI for language, predictive ML for demand forecasting, and the agentic Copilot built on the Cline SDK. The bottom rail is the foundation: a relational DB through Prisma, an async worker for timers and reminders, a shared TypeScript domain core that's already unit-tested, a consent ledger and audit log, and free-tier cloud hosting.");
}

// ---- 14b. AI engine flowchart ----
{
  const s = base();
  header(s, "The AI engine", "Three AI pillars, one human-in-the-loop pipeline");
  const step = (x, y, w, h, t, b, col) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y, w, h, fill: { color: C.white }, line: { color: col, width: 1.5 }, rectRadius: 0.1, shadow: { type: "outer", color: "000000", opacity: 0.1, blur: 5, offset: 2, angle: 90 } });
    s.addText([{ text: t, options: { bold: true, fontSize: 12, color: C.deep, breakLine: true } }, { text: b, options: { fontSize: 10, color: C.grey } }], { x: x + 0.12, y, w: w - 0.2, h, fontFace: FONT, valign: "middle" });
  };
  const lane = (y, label, col, items) => {
    s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y, w: 1.75, h: 1.2, fill: { color: col }, line: { color: col }, rectRadius: 0.1 });
    s.addText(label, { x: 0.6, y, w: 1.75, h: 1.2, fontFace: FONT, fontSize: 13, bold: true, color: C.white, align: "center", valign: "middle" });
    link(s, 2.37, y + 0.6, 0.2, 0, col);
    const w = 2.3, gap = 0.27;
    items.forEach(([t, b], i) => {
      const x = 2.6 + i * (w + gap);
      step(x, y + 0.08, w, 1.04, t, b, col);
      if (i < items.length - 1) link(s, x + w + 0.02, y + 0.6, gap - 0.04, 0, col);
    });
  };
  lane(1.7, "1 · Multilingual\nNLP intake", C.red, [
    ["🎙️ Speech-to-text", "Whisper voice notes"],
    ["🌐 Language ID", "Hindi · Hinglish · regional"],
    ["🧠 LLM extraction", "structured JSON + confidence"],
    ["🛡️ Guardrails", "schema check · normalise · confirm"],
  ]);
  lane(3.1, "2 · Predictive\nanalytics", C.teal, [
    ["🧮 Feature engineering", "lags · seasonality · festivals"],
    ["🌲 Gradient boosting", "quantile regression"],
    ["📊 Backtesting", "vs seasonal-naive baseline"],
    ["🚨 Shortage radar", "district × group × component"],
  ]);
  lane(4.5, "3 · Agentic\nCopilot", C.wine, [
    ["💭 Ask anything", "\"Which cases are at risk?\""],
    ["🛠️ Tool-calling agent", "Cline SDK · 6 typed tools"],
    ["📝 Grounded briefing", "drafts + suggested actions"],
    ["✋ Human approval", "nothing sent without a click"],
  ]);
  s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: 5.95, w: 12.1, h: 0.6, fill: { color: C.blush }, line: { color: C.red, width: 1 }, rectRadius: 0.1 });
  s.addText([
    { text: "Responsible AI: ", options: { bold: true, color: C.red } },
    { text: "AI handles language and insight. It never decides clinical urgency, fitness or verification. If one LLM provider is rate-limited, requests fail over to the other.", options: { color: C.ink } },
  ], { x: 0.8, y: 5.95, w: 11.8, h: 0.6, fontFace: FONT, fontSize: 12, valign: "middle" });
  s.addNotes("Three AI pillars. 1) Multilingual intake turns free-form text or voice in any supported language into a validated request. 2) Predictive analytics forecasts weekly demand ranges and shortage risk. 3) The agentic Copilot, built with the Cline SDK, answers coordinator questions using typed tools and only drafts actions; a person approves every one.");
}

// ---- 15. Where we are + challenges ----
{
  const s = base();
  header(s, "Progress & learnings", "Where we are, and the hard problems we solved");
  card(s, { x: 0.6, y: 1.7, w: 5.0, h: 4.8, accent: C.teal });
  s.addText("✅ Built & tested", { x: 0.85, y: 1.85, w: 4.6, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.teal });
  bullets(s, [
    "Shared domain rules: request lifecycle, role permissions, verification gate",
    "Provisional eligibility (90 / 120 days)",
    "Consent records, ~1 km location rounding, contracts",
    "Unit tests with node:test",
    "Full architecture, pipelines, data model & policies documented",
    "Build-phase plan: 4 parallel workstreams, 8 hours",
  ], { x: 0.85, y: 2.35, w: 4.6, h: 4.0, size: 13, bulletColor: C.teal });
  s.addText("🧗 Challenges → our resolution", { x: 5.85, y: 1.7, w: 6.8, h: 0.4, fontFace: FONT, fontSize: 16, bold: true, color: C.red });
  const ch = [
    ["WhatsApp doesn't stream donors' live location to bots", "Manual location updates (pin / GPS / typed), stored at ~1 km"],
    ["Donor incentive rules: no cash or substantial gifts", "Non-monetary recognition; token rewards flagged off"],
    ["AI can't authenticate prescription slips", "Removed slip reading; staff verification gates outreach"],
    ["WhatsApp donor templates outside 24 h cost money", "Free Web Push fallback for reminders"],
  ];
  ch.forEach(([p, r], i) => {
    const y = 2.2 + i * 1.08;
    s.addShape(pptx.ShapeType.roundRect, { x: 5.85, y, w: 3.3, h: 0.95, fill: { color: C.blush }, line: { color: C.blush }, rectRadius: 0.08 });
    s.addText(p, { x: 5.95, y, w: 3.1, h: 0.95, fontFace: FONT, fontSize: 11, color: C.wine, valign: "middle" });
    arrow(s, 9.2, y + 0.47, 0.3, C.grey);
    s.addShape(pptx.ShapeType.roundRect, { x: 9.55, y, w: 3.15, h: 0.95, fill: { color: C.white }, line: { color: C.teal }, rectRadius: 0.08 });
    s.addText(r, { x: 9.65, y, w: 2.95, h: 0.95, fontFace: FONT, fontSize: 11, color: C.ink, valign: "middle" });
  });
  s.addNotes("Be honest about status: foundation stage. The shared rules are implemented and tested; the app, bot and forecast service are built in the hackathon coding phase. Challenges come from docs/CHALLENGES.md.");
}

// ---- 16. Future roadmap ----
{
  const s = base();
  header(s, "What's next", "Future roadmap");
  const phases = [
    ["NEXT", "Pilot-ready", C.red, [
      "Pilot in one city with partner blood centres & NGOs",
      "2nd regional language + voice-first flows",
      "Partner org accounts & donation camp listings",
      "One-tap hospital confirmation links",
      "Multilingual eval score published",
    ]],
    ["SOON", "Integrate & scale", C.teal, [
      "Live stock sync with eRaktKosh / BBMS (with official approval)",
      "Train forecasts on real request & stock data",
      "Rare-blood-group & thalassemia recurring-need registries",
      "Stock-expiry alerts → redistribution between centres",
      "More Indian languages (Bengali, Tamil, Telugu…)",
    ]],
    ["LATER", "National impact", C.wine, [
      "ABHA (Ayushman Bharat) linked donor identity",
      "State / district shortage dashboards for health depts",
      "Approved token rewards via blood centres (if guidance allows)",
      "Ambulance / 108 & hospital HIS integration",
      "IVR / SMS channel for feature phones",
    ]],
  ];
  phases.forEach(([tag, t, col, items], i) => {
    const x = 0.6 + i * 4.1;
    s.addShape(pptx.ShapeType.rect, { x, y: 1.75, w: 3.9, h: 0.75, fill: { color: col }, line: { color: col } });
    s.addText([
      { text: tag + "  ", options: { bold: true, color: C.gold, fontSize: 13 } },
      { text: t, options: { bold: true, color: C.white, fontSize: 18 } },
    ], { x: x + 0.2, y: 1.75, w: 3.6, h: 0.75, fontFace: FONT, valign: "middle" });
    card(s, { x, y: 2.5, w: 3.9, h: 4.0, accent: null });
    bullets(s, items, { x: x + 0.2, y: 2.7, w: 3.55, h: 3.7, size: 13, bulletColor: col });
    if (i < 2) arrow(s, x + 3.92, 2.12, 0.16, C.grey);
  });
  s.addNotes("Future scope. eRaktKosh live sync and ABHA linkage need official partnerships; we design for them but don't claim them today. Expiry-based redistribution directly targets the 17.4 lakh discarded components.");
}

// ---- 17. Closing ----
{
  const s = base({ dark: true });
  s.addText("🩸", { x: 0.7, y: 0.9, w: 1.4, h: 1.4, fontSize: 60 });
  s.addText("Every drop collected should reach a patient in time.", { x: 0.7, y: 2.3, w: 11.8, h: 1.4, fontFace: FONT, fontSize: 40, bold: true, color: C.white });
  s.addText("RaktDoot turns a frightened request into a verified, tracked, closed case: families use a simple app, donors respond on WhatsApp, staff confirm every outcome.", { x: 0.7, y: 3.8, w: 11.5, h: 1.0, fontFace: FONT, fontSize: 20, color: "DDDDDD" });
  pill(s, "Partner with us: blood centres · hospitals · NGOs · state councils", { x: 0.7, y: 5.2, w: 8.2, h: 0.55, fill: C.red, size: 14 });
  s.addText("Thank you  ·  धन्यवाद", { x: 0.7, y: 6.1, w: 8, h: 0.5, fontFace: FONT, fontSize: 20, bold: true, color: C.gold });
  s.addNotes("Close with the ask: pilot partners. Then go to the live demo or Q&A.");
}

// ---- 18. Sources ----
{
  const s = base();
  header(s, "References", "Sources for statistics");
  bullets(s, [
    "Govt. of India in Parliament (2025): annual requirement ~14.6 million units; 14.6M collected in 2024-25 (via ORF Expert Speak, Oct 2025)",
    "Rajya Sabha state-wise data via Times of India (Aug 2026): 1.58 Cr units collected and 17.4 L components discarded in 2025; expiry the leading reason",
    "Union Health Ministry / NACO review via Outlook India (Apr 2026): ~10% districts lack a blood centre; many centres not on eRaktKosh / BBMS",
    "Kundu et al., BMJ Global Health 2024; 9:e015637: blood deserts in 8 northern states; only 61% can reach a blood-equipped facility within 1 hour",
    "Jindal & Nair, ISBT Transfusion Today (Jul 2025): ~4,263 blood centres, 29% govt hospital-based; platelet supply ~77.5% of demand",
    "Mammen et al., PLOS One 2022; 17(4):e0265951: national clinical demand & supply of blood in India",
    "MoRTH, Road Accidents in India 2023: ~1.73 lakh deaths",
    "Montgomery et al. (Million Death Study), PLOS One 2014: haemorrhage caused 38% of maternal deaths (2001-03)",
    "WHO Fact sheet, Blood safety and availability (Jun 2026)",
  ], { x: 0.6, y: 1.65, w: 12.1, h: 5.0, size: 13 });
  s.addNotes("Keep this slide in the appendix. Re-check the latest figures before the final presentation.");
}

// ---------- Write ----------
await pptx.writeFile({ fileName: OUT });
console.log(`Wrote ${pageNo} slides -> ${OUT}`);
