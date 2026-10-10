/**
 * Interface contracts between the four workstreams (see docs/TEAM_PLAN.md).
 * Freeze these in the kickoff; change only after telling the whole team.
 * Owner: Member 2 (core backend). Types only, so every stream can code against them immediately.
 */
import type {
  BloodComponent,
  BloodGroup,
  FinalOutcome,
  LocationSource,
  NotificationChannel,
  RequestStatus,
  VerificationStatus,
} from "./constants.ts";

// ---------- Member 1: channels and bot ----------

/** Supported conversation languages. hi-Latn = Hindi/Hinglish typed in Latin script. */
export const SUPPORTED_LANGUAGES = ["en", "hi", "hi-Latn", "mr"] as const;
export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number];

/** Normalised inbound message from WhatsApp or the simulator. */
export interface InboundMessage {
  channel: "WHATSAPP" | "SIMULATOR";
  from: string; // E.164 phone number
  messageId: string;
  receivedAt: string; // ISO timestamp
  kind: "text" | "audio" | "location" | "button";
  text?: string;
  audioMediaId?: string;
  location?: { lat: number; lng: number; label?: string };
  buttonId?: string;
}

export interface OutboundButton {
  id: string;
  title: string; // WhatsApp reply buttons allow max 3, 20 chars each
}

export interface OutboundMessage {
  to: string;
  kind: "text" | "buttons" | "location_request" | "template";
  text: string;
  buttons?: OutboundButton[];
  templateName?: string;
  templateParams?: string[];
}

// ---------- Member 1: AI intake output ----------

export interface ExtractedField<T> {
  value: T | null;
  confidence: number; // 0..1
}

export interface ExtractedRequest {
  language: LanguageCode;
  hospitalName: ExtractedField<string>;
  bloodGroup: ExtractedField<BloodGroup>;
  component: ExtractedField<BloodComponent>;
  units: ExtractedField<number>;
  neededBy: ExtractedField<string>; // ISO timestamp
  missingFields: Array<"hospitalName" | "bloodGroup" | "component" | "units" | "neededBy">;
  originalText: string;
}

// ---------- Member 2: core API shapes ----------

/** Confirmed intake only. Identity, verification and status are server-owned. */
export interface CreateBloodRequestInput {
  hospitalId: string;
  bloodGroup: BloodGroup;
  component: Exclude<BloodComponent, "UNKNOWN">;
  units: number;
  neededBy: string;
  language: LanguageCode;
  confirmed: true;
}

export interface ApiErrorDTO {
  error: { code: string; message: string; fields?: Record<string, string> };
}

export interface HospitalDTO {
  id: string;
  name: string;
  district: string;
  isSimulated: boolean;
}

export interface RequestEventDTO {
  id: string;
  fromStatus: RequestStatus | null;
  toStatus: RequestStatus;
  createdAt: string;
}

export interface BloodRequestDetailDTO {
  request: BloodRequestDTO;
  events: RequestEventDTO[];
}

export interface BloodRequestDTO {
  id: string;
  isSimulated?: boolean;
  status: RequestStatus;
  verification: VerificationStatus;
  outcome: FinalOutcome | null;
  hospitalId: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  neededBy: string | null;
  language: LanguageCode;
  createdAt: string;
}

export interface CentreResultDTO {
  centreId: string;
  name: string;
  phone: string;
  /** Present for the core API. Fictional centres must never appear to be real listings. */
  isSimulated?: boolean;
  distanceKm: number;
  stock: {
    units: number;
    status: "REPORTED" | "CONFIRMED" | "RESERVED";
    updatedAt: string;
    isSimulated: boolean;
  } | null;
}

export interface MatchCandidateDTO {
  donorId: string;
  displayName: string; // first name only; never the phone number
  distanceKm: number;
  score: number; // 0..1
  reasons: string[]; // e.g. "availability confirmed 2 h ago"
}

export interface LocationUpdateDTO {
  lat: number;
  lng: number;
  areaLabel?: string;
  source: LocationSource;
}

export interface NotificationJob {
  userId: string;
  channel: NotificationChannel;
  purpose: "URGENT_ALERT" | "REMINDER" | "STATUS_UPDATE" | "STAND_DOWN";
  message: OutboundMessage;
}

// ---------- Member 3: forecast service (HTTP JSON) ----------

export interface ForecastQuery {
  district: string;
  horizonWeeks: number; // 1..4
  bloodGroups?: BloodGroup[];
  components?: BloodComponent[];
}

export interface ForecastPoint {
  weekStart: string; // ISO date
  bloodGroup: BloodGroup;
  component: BloodComponent;
  p10: number;
  p50: number;
  p90: number;
  expectedSupply: number;
  shortageRisk: number; // 0..1, probability demand exceeds supply
  drivers: string[];
}

export interface ForecastResponse {
  district: string;
  generatedAt: string;
  isSynthetic: boolean;
  backtest: { modelMae: number; baselineMae: number; weeksTested: number };
  points: ForecastPoint[];
}