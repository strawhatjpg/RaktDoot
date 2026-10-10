import { BLOOD_COMPONENTS, BLOOD_GROUPS } from "./constants.ts";
import { SUPPORTED_LANGUAGES, type CreateBloodRequestInput } from "./contracts.ts";

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