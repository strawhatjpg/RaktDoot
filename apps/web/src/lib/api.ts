// Typed browser client for the RaktDoot API. Cookie session (same-origin) + M2's error shape.
import type {
  BloodRequestDTO, BloodRequestDetailDTO, CentreResultDTO, ConsentStateDTO, ConsentUpdateItem,
  CreateBloodRequestInput, DonorProfileDTO, DonorRegistrationInput, ExtractedRequest, ForecastResponse,
  HospitalDTO, OutboundMessage, UserRole,
} from "@raktdoot/shared";
import type { Backtest, Briefing, CopilotAnswer, CopilotDraft, DemoAccount, Me } from "./types.ts";

export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;
  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.status = status; this.code = code; this.fields = fields;
  }
}

async function call<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  let body = init.body;
  if (init.json !== undefined) { headers.set("Content-Type", "application/json"); body = JSON.stringify(init.json); }
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, body, credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiFailure(0, "NETWORK", "You appear to be offline. Check your connection and try again.");
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; fields?: Record<string, string> } } | null)?.error;
    throw new ApiFailure(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? "Something went wrong", err?.fields);
  }
  return data as T;
}

const post = (json: unknown, headers?: HeadersInit): RequestInit & { json?: unknown } => ({ method: "POST", json, headers });
const put = (json: unknown): RequestInit & { json?: unknown } => ({ method: "PUT", json });

export const api = {
  // Auth
  me: () => call<{ user: Me }>("/api/auth/me").then((r) => r.user),
  logout: () => call<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  demoAccounts: () => call<{ enabled: boolean; accounts: DemoAccount[] }>("/api/auth/demo"),
  demoLogin: (userId: string) => call<{ ok: true }>("/api/auth/demo", post({ userId })),
  waStart: () => call<{ code: string; link: string | null; expiresAt: string; botConfigured: boolean }>("/api/auth/whatsapp/start", { method: "POST" }),
  waPoll: (code: string) => call<{ status: "pending" | "confirmed" | "expired" }>("/api/auth/whatsapp/poll", post({ code })),
  /** M2: which sign-in methods this server has configured (Google, WhatsApp, demo). */
  signInMethods: () => call<{ methods: { google: boolean; whatsapp: boolean; demo: boolean } }>("/api/auth/session").then((r) => r.methods),

  // Requests + discovery (M2)
  hospitals: () => call<{ hospitals: HospitalDTO[] }>("/api/centres").then((r) => r.hospitals),
  centres: (hospitalId: string, bloodGroup: string, component: string) =>
    call<{ centres: CentreResultDTO[]; distanceKind: "STRAIGHT_LINE" }>(`/api/centres?${new URLSearchParams({ hospitalId, bloodGroup, component })}`),
  extract: (text: string) => call<{ extraction: ExtractedRequest & { usedAi: boolean } }>("/api/intake/extract", post({ text })).then((r) => r.extraction),
  createRequest: (input: CreateBloodRequestInput, idempotencyKey: string) =>
    call<{ request: BloodRequestDTO; replayed: boolean }>("/api/requests", post(input, { "Idempotency-Key": idempotencyKey })),
  myRequests: () => call<{ requests: BloodRequestDTO[] }>("/api/requests").then((r) => r.requests),
  request: (id: string) => call<BloodRequestDetailDTO>(`/api/requests/${encodeURIComponent(id)}`),
  /** M2: requesters may only cancel; staff close as FULFILLED once units are issued. */
  closeRequest: (id: string, outcome: "CANCELLED" | "FULFILLED") =>
    call<{ id: string; status: "CLOSED"; outcome: string }>(`/api/requests/${encodeURIComponent(id)}/close`, post({ outcome })),

  // Donor (M2)
  consent: () => call<ConsentStateDTO>("/api/consent"),
  updateConsent: (termsVersion: string, updates: ConsentUpdateItem[]) => call<ConsentStateDTO>("/api/consent", post({ termsVersion, updates })),
  donor: () => call<{ profile: DonorProfileDTO }>("/api/donors").then((r) => r.profile),
  saveDonor: (input: DonorRegistrationInput) => call<{ profile: DonorProfileDTO }>("/api/donors", put(input)).then((r) => r.profile),
  setAvailability: (availability: "AVAILABLE" | "PAUSED" | "UNAVAILABLE", unavailableUntil?: string) =>
    call<{ profile: DonorProfileDTO }>("/api/donors/availability", put({ availability, ...(unavailableUntil ? { unavailableUntil } : {}) })).then((r) => r.profile),
  setLocation: (lat: number, lng: number, source: "APP_GPS" | "MANUAL_ENTRY", areaLabel?: string) =>
    call<{ profile: DonorProfileDTO }>("/api/donors/location", put({ lat, lng, source, ...(areaLabel ? { areaLabel } : {}) })).then((r) => r.profile),
  deleteLocation: () => call<{ deleted: boolean }>("/api/donors/location", { method: "DELETE" }),

  // Staff (M3)
  briefing: (district: string) => call<{ briefing: Briefing; text: string }>(`/api/copilot/briefing?district=${encodeURIComponent(district)}`),
  forecast: (district: string, horizonWeeks = 4) => call<ForecastResponse>("/api/forecast", post({ district, horizonWeeks })),
  backtest: (district: string) => call<Backtest>(`/api/forecast/backtest?district=${encodeURIComponent(district)}`),
  ask: (question: string) => call<CopilotAnswer>("/api/copilot", post({ question })),
  drafts: (status?: CopilotDraft["status"]) => call<{ drafts: CopilotDraft[] }>(`/api/copilot/drafts${status ? `?status=${status}` : ""}`).then((r) => r.drafts),
  decideDraft: (id: string, body: { action: "approve" | "reject" } | { action: "edit"; message: string }) =>
    call<{ draft: CopilotDraft }>(`/api/copilot/drafts/${encodeURIComponent(id)}`, post(body)).then((r) => r.draft),

  // Simulator (M1)
  simulate: (from: string, input: { text?: string; buttonId?: string; location?: { lat: number; lng: number; label?: string } }) =>
    call<{ replies: OutboundMessage[] }>("/api/simulator", post({ from, ...input })).then((r) => r.replies),
};

/** Friendly message for M3 forecast/Copilot errors (503 FORECAST_UNAVAILABLE, 503 AI_NOT_CONFIGURED, 429). */
export function forecastErrorMessage(e: unknown): string {
  if (e instanceof ApiFailure) {
    if (e.code === "FORECAST_UNAVAILABLE") return "The forecast service is not reachable. Start it: cd services/forecast; .venv\\Scripts\\uvicorn main:app --port 8000";
    if (e.code === "AI_NOT_CONFIGURED") return "Copilot needs GEMINI_API_KEY + GEMINI_MODEL (or GROQ_API_KEY) in .env. Briefing, forecast and drafts still work.";
    if (e.code === "AI_RATE_LIMITED") return "The free AI tier is rate-limited right now. Try again in a minute.";
    return e.message;
  }
  return "Could not load data";
}

export function newIdempotencyKey(): string {
  return `app-${crypto.randomUUID()}`;
}

export const STAFF_ROLES: readonly UserRole[] = ["HOSPITAL_STAFF", "BLOOD_CENTRE_STAFF", "COORDINATOR", "ADMIN"];
export const isStaff = (me: Me | null | undefined): boolean => !!me && me.verified && STAFF_ROLES.includes(me.role);
