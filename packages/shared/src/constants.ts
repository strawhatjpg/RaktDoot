/**
 * Shared domain vocabulary for RaktDoot.
 * Uses `as const` arrays (not TS enums) so files run directly with Node type stripping.
 */

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

export const BLOOD_COMPONENTS = [
  "WHOLE_BLOOD",
  "PACKED_RED_CELLS",
  "PLATELETS",
  "PLASMA",
  "UNKNOWN",
] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

/**
 * Who uses the platform.
 * - REQUESTER: any member of the public (family member, friend) raising a request.
 * - DONOR: any registered member of the public willing to donate.
 * - HOSPITAL_STAFF / BLOOD_CENTRE_STAFF: verified institutional users who verify
 *   requests, confirm stock and confirm donations.
 * - COORDINATOR: NGO / platform volunteer who runs outreach and closes cases.
 * - ADMIN: platform operator.
 */
export const USER_ROLES = [
  "REQUESTER",
  "DONOR",
  "HOSPITAL_STAFF",
  "BLOOD_CENTRE_STAFF",
  "COORDINATOR",
  "ADMIN",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Roles allowed to verify a request before private donors are contacted. */
export const VERIFIER_ROLES: readonly UserRole[] = [
  "HOSPITAL_STAFF",
  "BLOOD_CENTRE_STAFF",
  "COORDINATOR",
  "ADMIN",
];

export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING_REVIEW", "VERIFIED", "REJECTED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** Request stages. A donor accepting is never the same as the request being fulfilled. */
export const REQUEST_STATUSES = [
  "DRAFT",
  "AWAITING_CONFIRMATION",
  "OPEN",
  "CENTRES_LISTED",
  "STOCK_CONFIRMED",
  "OUTREACH_ACTIVE",
  "DONOR_ACCEPTED",
  "DONOR_ARRIVED",
  "DONATION_CONFIRMED",
  "CLOSED",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const FINAL_OUTCOMES = ["FULFILLED", "CANCELLED", "EXPIRED", "UNRESOLVED"] as const;
export type FinalOutcome = (typeof FINAL_OUTCOMES)[number];

/**
 * Separate, purpose-specific consents. Each is asked in-chat (WhatsApp buttons)
 * or in-app, recorded with a timestamp, and can be withdrawn at any time.
 */
export const CONSENT_TYPES = [
  "TERMS",
  "URGENT_ALERTS",
  "DONATION_REMINDERS",
  "LOCATION_STORAGE",
  "CONTACT_SHARING",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const NOTIFICATION_CHANNELS = ["WHATSAPP", "APP_PUSH"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const LOCATION_SOURCES = ["WHATSAPP_SHARE", "APP_GPS", "MANUAL_ENTRY"] as const;
export type LocationSource = (typeof LOCATION_SOURCES)[number];

export const DONOR_SEXES = ["MALE", "FEMALE", "UNSPECIFIED"] as const;
export type DonorSex = (typeof DONOR_SEXES)[number];

/**
 * Donor-stated availability. New donors start PAUSED and must opt in to AVAILABLE.
 * UNAVAILABLE carries an end date; after it passes the donor is treated as PAUSED
 * (never silently AVAILABLE) until they reconfirm.
 */
export const AVAILABILITY_STATES = ["AVAILABLE", "PAUSED", "UNAVAILABLE"] as const;
export type Availability = (typeof AVAILABILITY_STATES)[number];

/** Version of the terms/privacy notice shown to users. Bump when the notice changes. */
export const CURRENT_TERMS_VERSION = "2026-10-v1";

export const MAX_TRAVEL_RADIUS_KM = 50;

/** CONTACT_SHARING is granted per request when a donor accepts, never globally. */
export const CHANNEL_SCOPED_CONSENTS: readonly ConsentType[] = ["URGENT_ALERTS", "DONATION_REMINDERS"];

/**
 * Minimum whole-blood donation intervals used for PROVISIONAL reminders only.
 * Final eligibility is always decided by blood centre screening.
 * UNSPECIFIED uses the longer, conservative interval.
 */
export const WHOLE_BLOOD_INTERVAL_DAYS: Readonly<Record<DonorSex, number>> = {
  MALE: 90,
  FEMALE: 120,
  UNSPECIFIED: 120,
};

/** A manually updated location older than this triggers a "please update" prompt. */
export const LOCATION_REFRESH_PROMPT_DAYS = 30;

/** Decimal places kept when storing donor coordinates (~1.1 km precision). */
export const STORED_COORDINATE_DECIMALS = 2;