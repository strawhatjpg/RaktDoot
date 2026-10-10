// Display helpers. Pure functions, safe on server and client.
import type { BloodComponent, RequestStatus, VerificationStatus } from "@raktdoot/shared";

export const COMPONENT_LABEL: Record<BloodComponent, string> = {
  WHOLE_BLOOD: "Whole blood",
  PACKED_RED_CELLS: "Red cells (PRBC)",
  PLATELETS: "Platelets",
  PLASMA: "Plasma",
  UNKNOWN: "Not sure",
};

export const COMPONENT_HINT: Partial<Record<BloodComponent, string>> = {
  WHOLE_BLOOD: "Rarely requested today",
  PACKED_RED_CELLS: "Surgery, anaemia, trauma",
  PLATELETS: "Dengue, chemotherapy",
  PLASMA: "Burns, clotting disorders",
};

export const STATUS_LABEL: Record<RequestStatus, string> = {
  DRAFT: "Draft",
  AWAITING_CONFIRMATION: "Awaiting confirmation",
  OPEN: "Request open",
  CENTRES_LISTED: "Centres listed",
  STOCK_CONFIRMED: "Stock confirmed",
  OUTREACH_ACTIVE: "Donors being contacted",
  DONOR_ACCEPTED: "Donor on the way",
  DONOR_ARRIVED: "Donor at centre",
  DONATION_CONFIRMED: "Donation confirmed",
  CLOSED: "Closed",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, { text: string; tone: "green" | "amber" | "red" | "" }> = {
  VERIFIED: { text: "Verified", tone: "green" },
  PENDING_REVIEW: { text: "Awaiting verification", tone: "amber" },
  UNVERIFIED: { text: "Unverified", tone: "" },
  REJECTED: { text: "Not verified", tone: "red" },
};

/** Journey shown to families. Index = progress order. */
export const JOURNEY: Array<{ status: RequestStatus; title: string; detail: string; icon: string }> = [
  { status: "OPEN", title: "Request received", detail: "Your request is recorded and nearby centres are shown.", icon: "📝" },
  { status: "OUTREACH_ACTIVE", title: "Verified & donors alerted", detail: "After hospital or coordinator verification, matched donors get a WhatsApp alert.", icon: "📣" },
  { status: "DONOR_ACCEPTED", title: "Donor on the way", detail: "A donor accepted and is heading to the blood centre.", icon: "🚶" },
  { status: "DONATION_CONFIRMED", title: "Donation confirmed", detail: "The blood centre confirmed the donation.", icon: "🩸" },
  { status: "CLOSED", title: "Case closed", detail: "Staff closed the case with an outcome.", icon: "✅" },
];

const ORDER: RequestStatus[] = ["DRAFT", "AWAITING_CONFIRMATION", "OPEN", "CENTRES_LISTED", "STOCK_CONFIRMED", "OUTREACH_ACTIVE", "DONOR_ACCEPTED", "DONOR_ARRIVED", "DONATION_CONFIRMED", "CLOSED"];
export const statusRank = (s: RequestStatus): number => ORDER.indexOf(s);

export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "—";
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  const future = diff < 0;
  const s = Math.abs(diff);
  const unit = s < 60 ? `${s}s` : s < 3600 ? `${Math.round(s / 60)} min` : s < 86400 ? `${Math.round(s / 3600)} h` : `${Math.round(s / 86400)} d`;
  return future ? `in ${unit}` : `${unit} ago`;
}

export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function shortId(id: string): string {
  return id.length > 8 ? `RD-${id.slice(-6).toUpperCase()}` : id;
}

/** Local datetime-local input value → canonical UTC ISO (what M2's validator expects). */
export function localInputToIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
