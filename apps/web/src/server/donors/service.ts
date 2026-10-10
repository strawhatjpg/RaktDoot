import {
  coarsenCoordinates, effectiveAvailability, hasActiveConsent, provisionalNextEligibleDate, shouldPromptLocationUpdate,
  validateAvailabilityUpdate, validateDonorRegistration, validateLocationUpdate,
  type ActorContext, type DonorProfileDTO, type DonorSex, type LocationSource,
} from "@raktdoot/shared";
import type { Prisma } from "@prisma/client";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";
import { loadConsents } from "../consent/service.ts";

type ProfileRow = Prisma.DonorProfileGetPayload<{ include: { location: true } }>;

/** Sources accepted from the web app. WHATSAPP_SHARE is only valid from the verified webhook (M1). */
export const APP_LOCATION_SOURCES: readonly LocationSource[] = ["APP_GPS", "MANUAL_ENTRY"];

const notRegistered = () => new ApiError(404, "DONOR_NOT_REGISTERED", "Register as a donor first");

function toDto(row: ProfileRow, now = new Date()): DonorProfileDTO {
  const sex = row.sex as DonorSex;
  return {
    bloodGroup: row.bloodGroup as DonorProfileDTO["bloodGroup"], sex, travelRadiusKm: row.travelRadiusKm,
    availability: row.availability, effectiveAvailability: effectiveAvailability(row.availability, row.unavailableUntil, now),
    unavailableUntil: row.unavailableUntil?.toISOString() ?? null, availabilityUpdatedAt: row.availabilityUpdatedAt.toISOString(),
    lastDonationAt: row.lastDonationAt?.toISOString() ?? null, lastDonationSource: row.lastDonationSource,
    provisionalNextReviewAt: row.lastDonationAt ? provisionalNextEligibleDate(row.lastDonationAt, sex).toISOString() : null,
    location: row.location ? {
      lat: row.location.lat, lng: row.location.lng, areaLabel: row.location.areaLabel, source: row.location.source as LocationSource,
      updatedAt: row.location.updatedAt.toISOString(), needsUpdate: shouldPromptLocationUpdate(row.location.updatedAt, now),
    } : null,
  };
}

export async function getDonorProfile(actor: ActorContext): Promise<DonorProfileDTO> {
  const row = await getDb().donorProfile.findUnique({ where: { userId: actor.userId }, include: { location: true } });
  if (!row) throw notRegistered();
  return toDto(row);
}

/** Create or update the caller's own profile. New donors start PAUSED until they opt in. */
export async function upsertDonorProfile(actor: ActorContext, body: unknown): Promise<{ profile: DonorProfileDTO; created: boolean }> {
  const parsed = validateDonorRegistration(body);
  if (!parsed.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the donor fields", parsed.fields);
  const input = parsed.value;
  return getDb().$transaction(async (tx) => {
    const { records } = await loadConsents(tx, actor.userId);
    if (!hasActiveConsent(records, "TERMS")) throw new ApiError(409, "TERMS_REQUIRED", "Accept the terms before registering as a donor");
    const existing = await tx.donorProfile.findUnique({ where: { userId: actor.userId } });
    const reported = input.lastDonationAt ? new Date(input.lastDonationAt) : null;
    // Self-reports may only move the date forward; they never erase a later recorded donation.
    const donation = reported && (!existing?.lastDonationAt || reported > existing.lastDonationAt)
      ? { lastDonationAt: reported, lastDonationSource: "SELF_REPORTED" } : {};
    const fields = { bloodGroup: input.bloodGroup, sex: input.sex, travelRadiusKm: input.travelRadiusKm };
    const row = await tx.donorProfile.upsert({
      where: { userId: actor.userId },
      create: { userId: actor.userId, ...fields, availability: "PAUSED", ...donation },
      update: { ...fields, ...donation },
      include: { location: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: existing ? "DONOR_PROFILE_UPDATED" : "DONOR_REGISTERED", entity: "DonorProfile", entityId: actor.userId } });
    return { profile: toDto(row), created: !existing };
  });
}

export async function updateAvailability(actor: ActorContext, body: unknown): Promise<DonorProfileDTO> {
  const parsed = validateAvailabilityUpdate(body);
  if (!parsed.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the availability fields", parsed.fields);
  return getDb().$transaction(async (tx) => {
    const existing = await tx.donorProfile.findUnique({ where: { userId: actor.userId } });
    if (!existing) throw notRegistered();
    if (parsed.value.availability === "AVAILABLE") {
      const { records } = await loadConsents(tx, actor.userId);
      if (!hasActiveConsent(records, "TERMS")) throw new ApiError(409, "TERMS_REQUIRED", "Accept the terms before becoming available");
    }
    const row = await tx.donorProfile.update({
      where: { userId: actor.userId },
      data: { availability: parsed.value.availability, unavailableUntil: parsed.value.unavailableUntil ? new Date(parsed.value.unavailableUntil) : null, availabilityUpdatedAt: new Date() },
      include: { location: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "DONOR_AVAILABILITY_UPDATED", entity: "DonorProfile", entityId: actor.userId } });
    return toDto(row);
  });
}

/**
 * Stores a coarsened (~1 km) location. Requires LOCATION_STORAGE consent.
 * `allowedSources` is fixed by the calling server code (app route vs WhatsApp webhook).
 */
export async function updateDonorLocation(actor: ActorContext, body: unknown, allowedSources: readonly LocationSource[] = APP_LOCATION_SOURCES): Promise<DonorProfileDTO> {
  const parsed = validateLocationUpdate(body, allowedSources);
  if (!parsed.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the location fields", parsed.fields);
  return getDb().$transaction(async (tx) => {
    const existing = await tx.donorProfile.findUnique({ where: { userId: actor.userId } });
    if (!existing) throw notRegistered();
    const { records } = await loadConsents(tx, actor.userId);
    if (!hasActiveConsent(records, "LOCATION_STORAGE")) throw new ApiError(403, "CONSENT_REQUIRED", "Allow location storage before sharing your location");
    const coarse = coarsenCoordinates(parsed.value);
    const data = { ...coarse, areaLabel: parsed.value.areaLabel ?? null, source: parsed.value.source, updatedAt: new Date() };
    await tx.donorLocation.upsert({ where: { userId: actor.userId }, create: { userId: actor.userId, ...data }, update: data });
    await tx.auditLog.create({ data: { actorId: actor.userId, action: "DONOR_LOCATION_UPDATED", entity: "DonorProfile", entityId: actor.userId } });
    const row = await tx.donorProfile.findUniqueOrThrow({ where: { userId: actor.userId }, include: { location: true } });
    return toDto(row);
  });
}

export async function deleteDonorLocation(actor: ActorContext): Promise<{ deleted: boolean }> {
  return getDb().$transaction(async (tx) => {
    const { count } = await tx.donorLocation.deleteMany({ where: { userId: actor.userId } });
    if (count > 0) await tx.auditLog.create({ data: { actorId: actor.userId, action: "DONOR_LOCATION_DELETED", entity: "DonorProfile", entityId: actor.userId } });
    return { deleted: count > 0 };
  });
}