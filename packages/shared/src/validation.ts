import {
  AVAILABILITY_STATES, BLOOD_COMPONENTS, BLOOD_GROUPS, CHANNEL_SCOPED_CONSENTS, CONSENT_TYPES, DONOR_SEXES,
  LOCATION_SOURCES, MAX_TRAVEL_RADIUS_KM, NOTIFICATION_CHANNELS, type ConsentType, type LocationSource,
} from "./constants.ts";
import {
  SUPPORTED_LANGUAGES, type AvailabilityUpdateInput, type ConsentUpdateInput, type ConsentUpdateItem,
  type CreateBloodRequestInput, type DonorRegistrationInput, type LocationUpdateDTO,
} from "./contracts.ts";

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> };

/** Explicit runtime schema. Reject extra keys to prevent mass assignment of privileged fields. */
export function validateCreateBloodRequest(input: unknown, now = new Date()): ValidationResult<CreateBloodRequestInput> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, fields: { body: "Expected an object" } };
  }
  const body = input as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const keys = ["hospitalId", "bloodGroup", "component", "units", "neededBy", "language", "confirmed"];
  for (const key of Object.keys(body)) if (!keys.includes(key)) fields[key] = "Unexpected field";
  if (typeof body.hospitalId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.hospitalId)) fields.hospitalId = "Select a hospital";
  if (!(BLOOD_GROUPS as readonly unknown[]).includes(body.bloodGroup)) fields.bloodGroup = "Invalid blood group";
  if (!(BLOOD_COMPONENTS as readonly unknown[]).includes(body.component) || body.component === "UNKNOWN") fields.component = "Confirm the required component";
  if (typeof body.units !== "number" || !Number.isSafeInteger(body.units) || body.units < 1 || body.units > 100) fields.units = "Enter an integer from 1 to 100";
  if (!(SUPPORTED_LANGUAGES as readonly unknown[]).includes(body.language)) fields.language = "Unsupported language";
  if (body.confirmed !== true) fields.confirmed = "User confirmation is required";
  // Canonical UTC ISO format avoids locale-dependent parsing and impossible-date rollover.
  const date = typeof body.neededBy === "string" ? new Date(body.neededBy) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== body.neededBy || date.getTime() <= now.getTime()) {
    fields.neededBy = "Use a future UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format";
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      hospitalId: body.hospitalId as string,
      bloodGroup: body.bloodGroup as CreateBloodRequestInput["bloodGroup"],
      component: body.component as CreateBloodRequestInput["component"],
      units: body.units as number,
      neededBy: date.toISOString(),
      language: body.language as CreateBloodRequestInput["language"],
      confirmed: true,
    },
  };
}

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{8,128}$/.test(value);
}

const DAY_MS = 86_400_000;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
/** Approximate bounding box for India; rejects swapped or obviously wrong coordinates. */
const INDIA_BOUNDS = { minLat: 6, maxLat: 37.5, minLng: 68, maxLng: 97.5 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnexpected(body: Record<string, unknown>, allowed: readonly string[], fields: Record<string, string>, prefix = ""): void {
  for (const key of Object.keys(body)) if (!allowed.includes(key)) fields[`${prefix}${key}`] = "Unexpected field";
}

/** Returns a Date only for canonical UTC ISO strings (Date.toISOString() output). */
function parseCanonicalIso(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.toISOString() !== value ? null : date;
}

export function validateConsentUpdate(input: unknown): ValidationResult<ConsentUpdateInput> {
  if (!isRecord(input)) return { ok: false, fields: { body: "Expected an object" } };
  const fields: Record<string, string> = {};
  rejectUnexpected(input, ["termsVersion", "updates"], fields);
  if (typeof input.termsVersion !== "string" || !/^[\w.-]{1,40}$/.test(input.termsVersion)) fields.termsVersion = "Provide the terms version that was shown";
  const updates: ConsentUpdateItem[] = [];
  if (!Array.isArray(input.updates) || input.updates.length < 1 || input.updates.length > 10) {
    fields.updates = "Provide 1 to 10 consent updates";
  } else {
    const seen = new Set<string>();
    input.updates.forEach((item: unknown, i: number) => {
      const prefix = `updates.${i}.`;
      if (!isRecord(item)) { fields[`updates.${i}`] = "Expected an object"; return; }
      rejectUnexpected(item, ["type", "channel", "granted"], fields, prefix);
      const type = item.type as ConsentType;
      if (!(CONSENT_TYPES as readonly unknown[]).includes(type)) { fields[`${prefix}type`] = "Unknown consent type"; return; }
      if (type === "CONTACT_SHARING") { fields[`${prefix}type`] = "Contact sharing is granted per request when accepting an alert"; return; }
      if (typeof item.granted !== "boolean") fields[`${prefix}granted`] = "Must be true or false";
      const scoped = CHANNEL_SCOPED_CONSENTS.includes(type);
      const channel = item.channel ?? null;
      if (scoped && !(NOTIFICATION_CHANNELS as readonly unknown[]).includes(channel)) fields[`${prefix}channel`] = "Choose WHATSAPP or APP_PUSH";
      if (!scoped && channel !== null) fields[`${prefix}channel`] = "This consent is not channel-specific; use null";
      const key = `${type}:${String(channel)}`;
      if (seen.has(key)) fields[`${prefix}type`] = "Duplicate consent update";
      seen.add(key);
      updates.push({ type, channel: channel as ConsentUpdateItem["channel"], granted: item.granted as boolean });
    });
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { termsVersion: input.termsVersion as string, updates } };
}

export function validateDonorRegistration(input: unknown, now: Date = new Date()): ValidationResult<DonorRegistrationInput> {
  if (!isRecord(input)) return { ok: false, fields: { body: "Expected an object" } };
  const fields: Record<string, string> = {};
  rejectUnexpected(input, ["bloodGroup", "sex", "travelRadiusKm", "ageConfirmed", "lastDonationAt"], fields);
  if (!(BLOOD_GROUPS as readonly unknown[]).includes(input.bloodGroup)) fields.bloodGroup = "Invalid blood group";
  if (!(DONOR_SEXES as readonly unknown[]).includes(input.sex)) fields.sex = "Choose MALE, FEMALE or UNSPECIFIED";
  const radius = input.travelRadiusKm;
  if (typeof radius !== "number" || !Number.isFinite(radius) || radius < 1 || radius > MAX_TRAVEL_RADIUS_KM) fields.travelRadiusKm = `Enter 1 to ${MAX_TRAVEL_RADIUS_KM} km`;
  if (input.ageConfirmed !== true) fields.ageConfirmed = "Donors must confirm they are 18 or older";
  let lastDonationAt: string | undefined;
  if (input.lastDonationAt !== undefined) {
    const date = parseCanonicalIso(input.lastDonationAt);
    if (!date || date.getTime() > now.getTime() || date.getUTCFullYear() < 1950) fields.lastDonationAt = "Use a past UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format";
    else lastDonationAt = date.toISOString();
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return {
    ok: true,
    value: {
      bloodGroup: input.bloodGroup as DonorRegistrationInput["bloodGroup"], sex: input.sex as DonorRegistrationInput["sex"],
      travelRadiusKm: radius as number, ageConfirmed: true, ...(lastDonationAt ? { lastDonationAt } : {}),
    },
  };
}

export function validateAvailabilityUpdate(input: unknown, now: Date = new Date()): ValidationResult<AvailabilityUpdateInput> {
  if (!isRecord(input)) return { ok: false, fields: { body: "Expected an object" } };
  const fields: Record<string, string> = {};
  rejectUnexpected(input, ["availability", "unavailableUntil"], fields);
  const availability = input.availability;
  if (!(AVAILABILITY_STATES as readonly unknown[]).includes(availability)) fields.availability = "Choose AVAILABLE, PAUSED or UNAVAILABLE";
  let unavailableUntil: string | undefined;
  if (availability === "UNAVAILABLE") {
    const date = parseCanonicalIso(input.unavailableUntil);
    if (!date || date.getTime() <= now.getTime() || date.getTime() > now.getTime() + 366 * DAY_MS) fields.unavailableUntil = "Use a future UTC timestamp within one year";
    else unavailableUntil = date.toISOString();
  } else if (input.unavailableUntil !== undefined) {
    fields.unavailableUntil = "Only allowed when UNAVAILABLE";
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { availability: availability as AvailabilityUpdateInput["availability"], ...(unavailableUntil ? { unavailableUntil } : {}) } };
}

export function validateLocationUpdate(input: unknown, allowedSources: readonly LocationSource[] = LOCATION_SOURCES): ValidationResult<LocationUpdateDTO> {
  if (!isRecord(input)) return { ok: false, fields: { body: "Expected an object" } };
  const fields: Record<string, string> = {};
  rejectUnexpected(input, ["lat", "lng", "areaLabel", "source"], fields);
  const { lat, lng } = input;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < INDIA_BOUNDS.minLat || lat > INDIA_BOUNDS.maxLat) fields.lat = "Latitude must be within India";
  if (typeof lng !== "number" || !Number.isFinite(lng) || lng < INDIA_BOUNDS.minLng || lng > INDIA_BOUNDS.maxLng) fields.lng = "Longitude must be within India";
  if (!(allowedSources as readonly unknown[]).includes(input.source)) fields.source = `Use one of: ${allowedSources.join(", ")}`;
  let areaLabel: string | undefined;
  if (input.areaLabel !== undefined) {
    const label = typeof input.areaLabel === "string" ? input.areaLabel.trim() : "";
    if (label.length < 1 || label.length > 80 || CONTROL_CHARS.test(label)) fields.areaLabel = "Use 1 to 80 printable characters";
    else areaLabel = label;
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields };
  return { ok: true, value: { lat: lat as number, lng: lng as number, source: input.source as LocationSource, ...(areaLabel ? { areaLabel } : {}) } };
}