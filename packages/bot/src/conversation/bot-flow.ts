/**
 * processInbound(InboundMessage) → OutboundMessage[]  (Member 1 hand-over to the team).
 * Same function serves WhatsApp and the web simulator.
 *
 * Flow: language → terms → role → (requester) intake → follow-ups → confirm → create
 *                                  (donor) consents (alerts / reminders / location) → location → blood group
 * Global commands work at any step: STOP, START, HELP, LANGUAGE, STATUS, LOCATION, DELETE MY DATA, LOGIN <code>.
 */
import type { BloodComponent, ExtractedRequest, InboundMessage, LanguageCode, OutboundButton, OutboundMessage } from "@raktdoot/shared";
import { REQUEST_NOT_CREATED, type CoreApi } from "../core-api.ts";
import type { LlmClient } from "../ai/llm-client.ts";
import type { Transcriber } from "../ai/transcribe.ts";
import type { WhatsAppLogin } from "../auth/whatsapp-login.ts";
import { parseLoginCommand } from "../auth/whatsapp-login.ts";
import { detectLanguage } from "../ai/detect-language.ts";
import { extractRequest, mergeFollowUp, computeMissing } from "../ai/extract-request.ts";
import { normalizeBloodGroup, normalizeComponent, normalizeUnits } from "../ai/normalize.ts";
import { formatIst, parseNeededBy } from "../ai/parse-time.ts";
import { t } from "../i18n/t.ts";
import type { MessageKey } from "../i18n/messages.ts";
import { DRAFT_TTL_MS, newState, type ConversationState, type IntakeField } from "./state.ts";

export interface BotDeps {
  core: CoreApi;
  llm: LlmClient | null;
  transcriber?: Transcriber | null;
  /** Downloads WhatsApp media; the simulator passes audio bytes differently. */
  downloadAudio?: (mediaId: string) => Promise<{ bytes: Uint8Array; mimeType: string }>;
  login?: WhatsAppLogin | null;
  appBaseUrl: string;
  now?: () => Date;
}

/** Button IDs (stable, language-independent). */
export const BTN = {
  LANG_EN: "lang:en", LANG_HI: "lang:hi", LANG_MR: "lang:mr",
  TERMS_YES: "terms:yes", TERMS_NO: "terms:no",
  ROLE_NEED: "role:need", ROLE_DONATE: "role:donate",
  YES: "yes", NO: "no",
  CONFIRM: "req:confirm", EDIT: "req:edit",
  COMP_PRBC: "comp:PACKED_RED_CELLS", COMP_PLT: "comp:PLATELETS", COMP_OTHER: "comp:OTHER", NOT_SURE: "skip",
} as const;

/** Invite buttons sent by M2's outreach: "invite:<inviteId>:accept|decline|pause". */
const INVITE_RE = /^invite:([\w-]+):(accept|decline|pause)$/;

const ASK_KEY: Record<IntakeField, MessageKey> = {
  hospitalName: "ask_hospitalName", bloodGroup: "ask_bloodGroup", component: "ask_component",
  units: "ask_units", neededBy: "ask_neededBy",
};
/** Ask in this order; neededBy is optional (user can skip). */
const ASK_ORDER: IntakeField[] = ["bloodGroup", "hospitalName", "component", "units", "neededBy"];
const OPTIONAL: IntakeField[] = ["neededBy", "component"];
const MAX_ASKS = 2;

const COMPONENT_LABEL: Record<BloodComponent, string> = {
  WHOLE_BLOOD: "Whole blood", PACKED_RED_CELLS: "Packed red cells (PRBC)", PLATELETS: "Platelets", PLASMA: "Plasma", UNKNOWN: "Not sure — confirm with hospital",
};

type Ctx = { to: string; lang: LanguageCode };
const text = (c: Ctx, key: MessageKey, vars?: Record<string, string | number>): OutboundMessage =>
  ({ to: c.to, kind: "text", text: t(c.lang, key, vars) });
const buttons = (c: Ctx, key: MessageKey, btns: Array<[string, MessageKey]>, vars?: Record<string, string | number>): OutboundMessage => ({
  to: c.to, kind: "buttons", text: t(c.lang, key, vars),
  buttons: btns.map(([id, k]): OutboundButton => ({ id, title: t(c.lang, k) })),
});
const yesNo = (c: Ctx, key: MessageKey) => buttons(c, key, [[BTN.YES, "btn_yes"], [BTN.NO, "btn_no"]]);

function languageButtons(c: Ctx): OutboundMessage {
  return buttons(c, "welcome", [[BTN.LANG_EN, "btn_lang_en"], [BTN.LANG_HI, "btn_lang_hi"], [BTN.LANG_MR, "btn_lang_mr"]]);
}
function roleButtons(c: Ctx): OutboundMessage {
  return buttons(c, "choose_role", [[BTN.ROLE_NEED, "btn_need_blood"], [BTN.ROLE_DONATE, "btn_donate"]]);
}
function termsButtons(c: Ctx, appBaseUrl: string): OutboundMessage {
  return buttons(c, "terms", [[BTN.TERMS_YES, "btn_accept_terms"], [BTN.TERMS_NO, "btn_decline"]], { url: `${appBaseUrl}/terms` });
}

/** Map typed replies ("haan", "yes", "हो") onto button IDs so typing works too. */
export function typedToButton(input: string): string | null {
  const s = input.trim().toLowerCase();
  if (/^(yes|y|haan|han|ha|haa|ji|हाँ|हां|हो|ho|ok|okay|theek|sahi|sahi hai|confirm|सही है|बरोबर)$/u.test(s)) return BTN.YES;
  if (/^(no|n|nahi|nahin|na|नहीं|नाही)$/u.test(s)) return BTN.NO;
  if (/^(english|eng|1)$/.test(s)) return BTN.LANG_EN;
  if (/^(hindi|hinglish|हिंदी|हिन्दी|2)$/u.test(s)) return BTN.LANG_HI;
  if (/^(marathi|मराठी|3)$/u.test(s)) return BTN.LANG_MR;
  if (/^(not sure|pata nahi|पता नहीं|माहीत नाही|skip)$/u.test(s)) return BTN.NOT_SURE;
  return null;
}

type Command = "STOP" | "START" | "HELP" | "LANGUAGE" | "STATUS" | "LOCATION" | "DELETE" | "RESTART" | "NEED" | "DONATE";
export function parseCommand(input: string): Command | null {
  const s = input.trim().toUpperCase();
  if (/^(STOP|UNSUBSCRIBE|BAND KARO)$/.test(s)) return "STOP";
  if (/^START$/.test(s)) return "START";
  if (/^(HELP|MENU|मदद)$/u.test(s)) return "HELP";
  if (/^(LANGUAGE|BHASHA|भाषा)$/u.test(s)) return "LANGUAGE";
  if (/^STATUS$/.test(s)) return "STATUS";
  if (/^(LOCATION|UPDATE LOCATION)$/.test(s)) return "LOCATION";
  if (/^DELETE MY DATA$/.test(s)) return "DELETE";
  if (/^(HI|HELLO|NAMASTE|नमस्ते|नमस्कार|RESTART)$/u.test(s)) return "RESTART";
  if (/^NEED BLOOD$/.test(s)) return "NEED";
  if (/^DONATE$/.test(s)) return "DONATE";
  return null;
}

function nextQuestion(state: ConversationState): IntakeField | null {
  const missing = state.draft ? state.draft.missingFields : ASK_ORDER;
  for (const f of ASK_ORDER) {
    if (!missing.includes(f) || state.skipped.includes(f)) continue;
    // Optional fields are asked at most MAX_ASKS times; required ones until answered.
    if (OPTIONAL.includes(f) && (state.asked[f] ?? 0) >= MAX_ASKS) continue;
    return f;
  }
  return null;
}

/**
 * Interpret a short reply in the context of the question just asked ("2" → units,
 * "6 pm" → neededBy). Returns true if the field was filled. Values are validated
 * by the same deterministic normalisers used for full messages.
 */
export function answerField(state: ConversationState, field: IntakeField, body: string, now: Date): boolean {
  const d = state.draft;
  if (!d) return false;
  const s = body.trim();
  switch (field) {
    case "units": {
      const n = normalizeUnits(s);
      if (n === null) return false;
      d.units = { value: n, confidence: 1 };
      break;
    }
    case "bloodGroup": {
      const g = normalizeBloodGroup(s);
      if (!g) return false;
      d.bloodGroup = { value: g, confidence: 1 };
      break;
    }
    case "component": {
      const c = normalizeComponent(s);
      if (!c) return false;
      d.component = { value: c, confidence: 1 };
      break;
    }
    case "neededBy": {
      const iso = parseNeededBy(s, now);
      if (!iso) return false;
      d.neededBy = { value: iso, confidence: 1 };
      break;
    }
    case "hospitalName": {
      if (s.length < 3 || s.length > 120 || normalizeBloodGroup(s) || /^\d+$/.test(s)) return false;
      d.hospitalName = { value: s, confidence: 1 };
      break;
    }
  }
  d.missingFields = computeMissing(d);
  return true;
}

function askField(c: Ctx, field: IntakeField): OutboundMessage {
  if (field === "component") {
    return buttons(c, "ask_component", [[BTN.COMP_PRBC, "btn_component_prbc"], [BTN.COMP_PLT, "btn_component_platelets"], [BTN.NOT_SURE, "btn_not_sure"]]);
  }
  if (field === "neededBy") return buttons(c, "ask_neededBy", [[BTN.NOT_SURE, "btn_not_sure"]]);
  return text(c, ASK_KEY[field]);
}

function confirmCard(c: Ctx, state: ConversationState): OutboundMessage {
  const d = state.draft!;
  return buttons(c, "confirm_card", [[BTN.CONFIRM, "btn_confirm"], [BTN.EDIT, "btn_edit"]], {
    hospital: d.hospitalName.value ?? "—",
    group: d.bloodGroup.value ?? "—",
    component: COMPONENT_LABEL[d.component.value ?? "UNKNOWN"],
    units: d.units.value ?? "—",
    neededBy: formatIst(d.neededBy.value),
  });
}

/** After any intake update: ask the next question or show the confirmation card. */
function continueIntake(c: Ctx, state: ConversationState): OutboundMessage[] {
  const field = nextQuestion(state);
  if (field) {
    state.step = "FOLLOW_UP";
    state.lastAsked = field;
    state.asked[field] = (state.asked[field] ?? 0) + 1;
    return [askField(c, field)];
  }
  state.step = "CONFIRM";
  return [confirmCard(c, state)];
}

function applySkip(state: ConversationState, field: IntakeField): void {
  if (!state.skipped.includes(field)) state.skipped.push(field);
  if (field === "component" && state.draft) {
    state.draft.component = { value: "UNKNOWN", confidence: 1 };
    state.draft.missingFields = computeMissing(state.draft).filter((f) => f !== "component");
  }
}

export async function processInbound(msg: InboundMessage, deps: BotDeps): Promise<OutboundMessage[]> {
  const now = deps.now?.() ?? new Date();
  let state = (await deps.core.getState(msg.from)) ?? newState(now);
  if (state.draft && now.getTime() - Date.parse(state.updatedAt) > DRAFT_TTL_MS) {
    delete state.draft;
    state.skipped = [];
    state.asked = {};
    if (state.step === "FOLLOW_UP" || state.step === "CONFIRM") state.step = "IDLE";
  }

  const out = await route(msg, state, deps, now);
  state.updatedAt = now.toISOString();
  await deps.core.saveState(msg.from, state);
  return out;
}

async function route(msg: InboundMessage, state: ConversationState, deps: BotDeps, now: Date): Promise<OutboundMessage[]> {
  const c: Ctx = { to: msg.from, lang: state.lang };
  const core = deps.core;

  // ----- Voice note → text, then treat as a typed message -----
  let body = msg.kind === "text" ? (msg.text ?? "") : "";
  if (msg.kind === "audio") {
    try {
      if (!deps.transcriber || !deps.downloadAudio || !msg.audioMediaId) throw new Error("voice unavailable");
      const audio = await deps.downloadAudio(msg.audioMediaId);
      body = (await deps.transcriber.transcribe(audio.bytes, audio.mimeType)).text;
    } catch {
      return [text(c, "voice_failed")];
    }
  }

  // ----- Global commands (work at any step) -----
  const login = parseLoginCommand(body);
  if (login) {
    const ok = deps.login ? await deps.login.confirm(login, msg.from) : false;
    return [text(c, ok ? "login_ok" : "login_bad")];
  }
  const cmd = body ? parseCommand(body) : null;
  if (cmd === "STOP") {
    for (const type of ["URGENT_ALERTS", "DONATION_REMINDERS"] as const) await core.recordConsent(msg.from, type, "WHATSAPP", false, "whatsapp:STOP");
    state.consents.alerts = false;
    state.consents.reminders = false;
    return [text(c, "stopped")];
  }
  if (cmd === "DELETE") {
    await core.requestDeletion(msg.from);
    return [text(c, "deleted")];
  }
  if (cmd === "HELP") return [text(c, "help")];
  // (At step NEW, greetings fall through to first-contact handling so the script is detected.)
  if (cmd === "LANGUAGE") {
    state.step = "LANG";
    return [languageButtons(c)];
  }

  // ----- Donor invite replies from M2's outreach waves -----
  const invite = msg.kind === "button" ? INVITE_RE.exec(msg.buttonId ?? "") : null;
  if (invite) {
    const response = invite[2] === "accept" ? "ACCEPT" : invite[2] === "decline" ? "DECLINE" : "PAUSE";
    await core.respondToInvite(msg.from, invite[1]!, response);
    return [text(c, response === "ACCEPT" ? "invite_accepted" : response === "DECLINE" ? "invite_declined" : "invite_paused")];
  }

  const button = msg.kind === "button" ? msg.buttonId ?? "" : body ? typedToButton(body) : null;

  // ----- First contact -----
  if (state.step === "NEW") {
    state.firstScript = /[\u0900-\u097F]/u.test(body) ? "devanagari" : "latin";
    const guess = body ? detectLanguage(body) : null;
    if (guess && guess.language !== "en" && guess.confidence >= 0.6) state.lang = guess.language;
    // "B+ 2 units at Ruby Hall" as the very first message: keep it, use it after onboarding.
    if (body && looksLikeRequest(body)) state.pendingText = body.slice(0, 2000);
    state.step = "LANG";
    return [languageButtons({ ...c, lang: state.lang })];
  }

  if (state.step === "LANG") {
    if (button === BTN.LANG_EN) state.lang = "en";
    else if (button === BTN.LANG_HI) state.lang = state.firstScript === "devanagari" ? "hi" : "hi-Latn";
    else if (button === BTN.LANG_MR) state.lang = "mr";
    else return [languageButtons(c)];
    await core.upsertUser(msg.from, { language: state.lang });
    c.lang = state.lang;
    if (state.termsAccepted) {
      state.step = "ROLE";
      return [roleButtons(c)];
    }
    state.step = "TERMS";
    return [termsButtons(c, deps.appBaseUrl)];
  }

  if (state.step === "TERMS") {
    if (button === BTN.TERMS_YES || button === BTN.YES) {
      state.termsAccepted = true;
      await core.recordConsent(msg.from, "TERMS", null, true, "whatsapp:button");
      if (state.pendingText) {
        const pending = state.pendingText;
        delete state.pendingText;
        await startIntake(c, state, msg, deps);
        return stepHandlers({ ...msg, kind: "text", text: pending }, state, deps, now, c, pending, null);
      }
      state.step = "ROLE";
      return [roleButtons(c)];
    }
    if (button === BTN.TERMS_NO || button === BTN.NO) {
      delete state.pendingText;
      state.step = "DECLINED";
      return [text(c, "terms_declined")];
    }
    return [termsButtons(c, deps.appBaseUrl)];
  }

  if (state.step === "DECLINED") {
    if (cmd === "RESTART") {
      state.step = "TERMS";
      return [termsButtons(c, deps.appBaseUrl)];
    }
    return [text(c, "terms_declined")];
  }

  // From here on the user has accepted terms.
  if (cmd === "START") {
    // Consent is never silently restored: ask again, purpose by purpose.
    state.step = "CONSENT_ALERTS";
    return [text(c, "resumed"), yesNo(c, "consent_alerts")];
  }
  if (cmd === "STATUS") {
    const status = await core.requestStatus(msg.from);
    return [status ? { to: c.to, kind: "text", text: status } : text(c, "no_status")];
  }
  if (cmd === "LOCATION") {
    // Return to whatever the user was doing afterwards (e.g. a half-finished request).
    if (state.step !== "DONOR_LOCATION") state.resumeStep = state.step;
    if (state.consents.location !== true) {
      state.step = "CONSENT_LOCATION";
      return [yesNo(c, "consent_location")];
    }
    state.step = "DONOR_LOCATION";
    return [{ to: c.to, kind: "location_request", text: t(c.lang, "share_location") }];
  }
  if (cmd === "NEED" || button === BTN.ROLE_NEED) return startIntake(c, state, msg, deps);
  if (cmd === "DONATE" || button === BTN.ROLE_DONATE) {
    await core.upsertUser(msg.from, { role: "DONOR" });
    state.role = "DONOR";
    state.step = "CONSENT_ALERTS";
    return [yesNo(c, "consent_alerts")];
  }
  if (cmd === "RESTART") {
    state.step = "ROLE";
    return [roleButtons(c)];
  }

  return stepHandlers(msg, state, deps, now, c, body, button);
}

async function startIntake(c: Ctx, state: ConversationState, msg: InboundMessage, deps: BotDeps): Promise<OutboundMessage[]> {
  await deps.core.upsertUser(msg.from, { role: "REQUESTER" });
  state.role = "REQUESTER";
  delete state.draft;
  state.asked = {};
  state.skipped = [];
  state.step = "INTAKE";
  return [text(c, "describe_need")];
}

async function stepHandlers(
  msg: InboundMessage, state: ConversationState, deps: BotDeps, now: Date, c: Ctx, body: string, button: string | null,
): Promise<OutboundMessage[]> {
  const core = deps.core;

  // Location pins are accepted at any step (manual update anytime), with consent.
  if (msg.kind === "location" && msg.location) {
    if (state.consents.location !== true) {
      state.step = "CONSENT_LOCATION";
      return [yesNo(c, "consent_location")];
    }
    const { areaLabel } = await core.updateLocation(msg.from, { ...msg.location, ...(msg.location.label ? { areaLabel: msg.location.label } : {}), source: "WHATSAPP_SHARE" });
    return [text(c, "location_saved", { area: areaLabel }), ...afterLocation(c, state)];
  }

  switch (state.step) {
    case "INTAKE": {
      if (!body) return [text(c, "describe_need")];
      const extracted = await extractRequest(body, { llm: deps.llm, now, languageHint: state.lang });
      state.draft = { ...extracted, language: state.lang };
      delete (state.draft as { usedAi?: boolean }).usedAi;
      const out = !extracted.usedAi && extracted.missingFields.length >= 3 && deps.llm ? [text(c, "ai_unavailable")] : [];
      return [...out, ...continueIntake(c, state)];
    }

    case "FOLLOW_UP": {
      const field = state.lastAsked;
      if (!state.draft || !field) return startIntake(c, state, msg, deps);
      if (button === BTN.NOT_SURE) {
        // Only optional fields can be skipped; hospital, group and units are needed to act.
        if (OPTIONAL.includes(field)) {
          applySkip(state, field);
          return continueIntake(c, state);
        }
        return [askField(c, field)];
      }
      if (field === "component" && button?.startsWith("comp:")) {
        if (button === BTN.COMP_OTHER) return [text(c, "ask_component")];
        state.draft.component = { value: button.slice(5) as BloodComponent, confidence: 1 };
        state.draft.missingFields = computeMissing(state.draft);
        return continueIntake(c, state);
      }
      if (!body) return [askField(c, field)];
      // Longer replies may carry several fields ("O neg, 2 unit, Ruby Hall"): extract them all,
      // then interpret a short reply as the answer to the question just asked ("2", "6 pm").
      const fullSentence = body.trim().split(/\s+/).length > 3;
      if (fullSentence) {
        const next = await extractRequest(body, { llm: deps.llm, now, languageHint: state.lang });
        state.draft = mergeFollowUp(state.draft, { ...next, language: state.lang });
      }
      if (!fullSentence || state.draft.missingFields.includes(field)) {
        if (!answerField(state, field, body, now) && !fullSentence) return [askField(c, field)];
      }
      return continueIntake(c, state);
    }

    case "CONFIRM": {
      const d = state.draft;
      if (!d) return startIntake(c, state, msg, deps);
      if (button === BTN.CONFIRM || button === BTN.YES) {
        if (!d.hospitalName.value || !d.bloodGroup.value || !d.units.value) return continueIntake(c, state);
        const created = await core.createRequest({
          requesterPhone: msg.from,
          hospitalName: d.hospitalName.value,
          bloodGroup: d.bloodGroup.value,
          component: d.component.value ?? "UNKNOWN",
          units: d.units.value,
          neededBy: d.neededBy.value,
          language: state.lang,
          originalText: d.originalText,
        });
        if (created.id === REQUEST_NOT_CREATED) {
          // Hospital not in the directory: keep everything else, ask only for the hospital again.
          const examples = /\(e\.g\.\s*([^)]{1,200})\)/.exec(created.trackUrl)?.[1]?.trim() ?? "—";
          d.hospitalName = { value: null, confidence: 0 };
          d.missingFields = computeMissing(d);
          state.step = "FOLLOW_UP";
          state.lastAsked = "hospitalName";
          state.asked.hospitalName = (state.asked.hospitalName ?? 0) + 1;
          return [text(c, "hospital_not_found", { examples })];
        }
        delete state.draft;
        state.step = "IDLE";
        return [text(c, "request_submitted", { id: created.id, url: created.trackUrl }), text(c, "safety_note")];
      }
      if (button === BTN.EDIT || button === BTN.NO) {
        // Start over: the next message is extracted from scratch.
        delete state.draft;
        state.asked = {};
        state.skipped = [];
        state.step = "INTAKE";
        return [text(c, "edit_prompt")];
      }
      if (body) {
        // Free-text correction on the confirm card ("units 3 hai").
        const next = await extractRequest(body, { llm: deps.llm, now, languageHint: state.lang });
        // A correction must override, so it is applied at full confidence.
        state.draft = mergeFollowUp(d, boost({ ...next, language: state.lang }));
        return continueIntake(c, state);
      }
      return [confirmCard(c, state)];
    }

    case "CONSENT_ALERTS":
    case "CONSENT_REMINDERS":
    case "CONSENT_LOCATION": {
      if (button !== BTN.YES && button !== BTN.NO) {
        const key = state.step === "CONSENT_ALERTS" ? "consent_alerts" : state.step === "CONSENT_REMINDERS" ? "consent_reminders" : "consent_location";
        return [yesNo(c, key)];
      }
      const granted = button === BTN.YES;
      if (state.step === "CONSENT_ALERTS") {
        state.consents.alerts = granted;
        await core.recordConsent(msg.from, "URGENT_ALERTS", "WHATSAPP", granted, "whatsapp:button");
        state.step = "CONSENT_REMINDERS";
        return [yesNo(c, "consent_reminders")];
      }
      if (state.step === "CONSENT_REMINDERS") {
        state.consents.reminders = granted;
        await core.recordConsent(msg.from, "DONATION_REMINDERS", "WHATSAPP", granted, "whatsapp:button");
        state.step = "CONSENT_LOCATION";
        return [yesNo(c, "consent_location")];
      }
      state.consents.location = granted;
      await core.recordConsent(msg.from, "LOCATION_STORAGE", null, granted, "whatsapp:button");
      if (granted) {
        state.step = "DONOR_LOCATION";
        return [text(c, "consent_saved"), { to: c.to, kind: "location_request", text: t(c.lang, "share_location") }];
      }
      return [text(c, "consent_saved"), ...afterLocation(c, state)];
    }

    case "DONOR_LOCATION": {
      if (!body.trim()) return [{ to: c.to, kind: "location_request", text: t(c.lang, "share_location") }];
      if (state.consents.location !== true) {
        state.step = "CONSENT_LOCATION";
        return [yesNo(c, "consent_location")];
      }
      // Typed area name: no coordinates (NaN, never a fake 0,0 pin). M2 resolves the label.
      const { areaLabel } = await core.updateLocation(msg.from, { lat: Number.NaN, lng: Number.NaN, areaLabel: body.trim().slice(0, 80), source: "MANUAL_ENTRY" });
      return [text(c, "location_saved", { area: areaLabel }), ...afterLocation(c, state)];
    }

    case "DONOR_GROUP": {
      const group = normalizeBloodGroup(body);
      if (!group) return [text(c, "ask_bloodGroup")];
      await core.updateDonor(msg.from, { bloodGroup: group });
      state.donorRegistered = true;
      state.step = "IDLE";
      return [text(c, "consent_saved"), text(c, "help")];
    }

    case "ROLE":
      return [roleButtons(c)];

    default: {
      if (msg.kind !== "text" && msg.kind !== "audio" && msg.kind !== "button") return [text(c, "unsupported")];
      // IDLE: a free-text message that looks like a blood request starts intake directly.
      if (body && looksLikeRequest(body)) {
        await startIntake(c, state, msg, deps);
        return stepHandlers(msg, state, deps, now, c, body, button);
      }
      return [text(c, "fallback")];
    }
  }
}

/** A message that already describes a blood need. */
export function looksLikeRequest(body: string): boolean {
  return !!normalizeBloodGroup(body) || /(blood|khoon|khun|रक्त|खून|platelet|प्लेटलेट|plasma|प्लाज़्मा|प्लाझ्मा)/iu.test(body);
}

/** A user correction must win over earlier values, so give its found fields full confidence. */
function boost(r: ExtractedRequest): ExtractedRequest {
  const up = <T>(f: { value: T | null; confidence: number }) => (f.value === null ? f : { value: f.value, confidence: 1 });
  return { ...r, hospitalName: up(r.hospitalName), bloodGroup: up(r.bloodGroup), component: up(r.component), units: up(r.units), neededBy: up(r.neededBy) };
}

/**
 * Where to go after a location update. During donor sign-up → ask blood group.
 * If LOCATION was typed mid-way through something else → resume that step.
 */
function afterLocation(c: Ctx, state: ConversationState): OutboundMessage[] {
  const resume = state.resumeStep;
  delete state.resumeStep;
  if (resume && resume !== "DONOR_LOCATION" && resume !== "CONSENT_LOCATION") {
    state.step = resume;
    if (resume === "CONFIRM" && state.draft) return [confirmCard(c, state)];
    if (resume === "FOLLOW_UP" && state.draft && state.lastAsked) return [askField(c, state.lastAsked)];
    if (resume === "INTAKE") return [text(c, "describe_need")];
    if (resume === "ROLE") return [roleButtons(c)];
    return [];
  }
  if (state.role === "DONOR" && !state.donorRegistered) {
    state.step = "DONOR_GROUP";
    return [text(c, "donor_registered")];
  }
  state.step = "IDLE";
  return [];
}