/**
 * SIMULATED demo data so the Copilot works before Member 2's APIs land.
 * Fictional hospitals, centres and donors only; never real people.
 * Replace with a DB-backed CopilotDataSource at Sync 2.
 */
import type { BloodRequestDTO, CentreResultDTO, MatchCandidateDTO } from "@raktdoot/shared";
import type { CaseEventDTO, CopilotDataSource } from "./data-source.ts";

export const MOCK_DISTRICT = "Pune";

const REQUESTS: BloodRequestDTO[] = [
  {
    id: "REQ-1001",
    status: "OUTREACH_ACTIVE",
    verification: "VERIFIED",
    outcome: null,
    hospitalId: "HOSP-01",
    hospitalName: "Sahyadri Demo Hospital (simulated)",
    bloodGroup: "O+",
    component: "PLATELETS",
    units: 3,
    neededBy: "2026-10-11T08:00:00Z",
    language: "hi-Latn",
    createdAt: "2026-10-10T06:30:00Z",
  },
  {
    id: "REQ-1002",
    status: "CENTRES_LISTED",
    verification: "PENDING_REVIEW",
    outcome: null,
    hospitalId: "HOSP-02",
    hospitalName: "Deccan Demo Medical Centre (simulated)",
    bloodGroup: "B+",
    component: "PACKED_RED_CELLS",
    units: 2,
    neededBy: "2026-10-12T10:00:00Z",
    language: "mr",
    createdAt: "2026-10-10T07:15:00Z",
  },
  {
    id: "REQ-1003",
    status: "STOCK_CONFIRMED",
    verification: "VERIFIED",
    outcome: null,
    hospitalId: "HOSP-03",
    hospitalName: "Kothrud Demo Hospital (simulated)",
    bloodGroup: "A-",
    component: "PLASMA",
    units: 1,
    neededBy: null,
    language: "en",
    createdAt: "2026-10-09T18:40:00Z",
  },
  {
    id: "REQ-0990",
    status: "CLOSED",
    verification: "VERIFIED",
    outcome: "FULFILLED",
    hospitalId: "HOSP-01",
    hospitalName: "Sahyadri Demo Hospital (simulated)",
    bloodGroup: "AB+",
    component: "WHOLE_BLOOD",
    units: 1,
    neededBy: null,
    language: "hi",
    createdAt: "2026-10-08T09:00:00Z",
  },
];

const CENTRES: CentreResultDTO[] = [
  {
    centreId: "CTR-01",
    name: "City Demo Blood Centre (simulated)",
    phone: "+91-00000-00001",
    distanceKm: 2.1,
    stock: { units: 1, status: "REPORTED", updatedAt: "2026-10-10T07:50:00Z", isSimulated: true },
  },
  {
    centreId: "CTR-02",
    name: "Red Cross Demo Centre (simulated)",
    phone: "+91-00000-00002",
    distanceKm: 4.8,
    stock: { units: 4, status: "CONFIRMED", updatedAt: "2026-10-10T05:10:00Z", isSimulated: true },
  },
  {
    centreId: "CTR-03",
    name: "Hadapsar Demo Blood Bank (simulated)",
    phone: "+91-00000-00003",
    distanceKm: 9.3,
    stock: null,
  },
];

const DONORS: MatchCandidateDTO[] = [
  { donorId: "DNR-11", displayName: "Aarav", distanceKm: 3.2, score: 0.91, reasons: ["availability confirmed 2 h ago", "3.2 km from the centre", "no alerts in 30 days"] },
  { donorId: "DNR-12", displayName: "Priya", distanceKm: 5.0, score: 0.84, reasons: ["availability confirmed today", "can reach in 30 min"] },
  { donorId: "DNR-13", displayName: "Rohan", distanceKm: 6.7, score: 0.77, reasons: ["available this week", "1 alert in 30 days"] },
  { donorId: "DNR-14", displayName: "Sneha", distanceKm: 8.1, score: 0.7, reasons: ["available weekends", "8.1 km from the centre"] },
  { donorId: "DNR-15", displayName: "Kabir", distanceKm: 11.4, score: 0.62, reasons: ["availability 9 days old"] },
  { donorId: "DNR-16", displayName: "Meera", distanceKm: 12.9, score: 0.55, reasons: ["wider radius (wave 2)"] },
];

const EVENTS: Record<string, CaseEventDTO[]> = {
  "REQ-1001": [
    { at: "2026-10-10T06:30:00Z", kind: "CREATED", summary: "Family raised request on WhatsApp (Hinglish)" },
    { at: "2026-10-10T06:32:00Z", kind: "CENTRES_LISTED", summary: "3 nearby centres shown; 1 reports 1 platelet unit (simulated)" },
    { at: "2026-10-10T06:55:00Z", kind: "VERIFIED", summary: "Verified by hospital staff", actorRole: "HOSPITAL_STAFF" },
    { at: "2026-10-10T07:00:00Z", kind: "WAVE_SENT", summary: "Wave 1 sent to 5 ranked donors", actorRole: "COORDINATOR" },
    { at: "2026-10-10T07:20:00Z", kind: "DONOR_ACCEPTED", summary: "1 donor accepted (ETA 40 min); 2 units still uncovered" },
  ],
  "REQ-1002": [
    { at: "2026-10-10T07:15:00Z", kind: "CREATED", summary: "Family raised request on WhatsApp (Marathi)" },
    { at: "2026-10-10T07:16:00Z", kind: "CENTRES_LISTED", summary: "3 nearby centres shown; stock not confirmed" },
  ],
  "REQ-1003": [
    { at: "2026-10-09T18:40:00Z", kind: "CREATED", summary: "Raised by blood centre staff" },
    { at: "2026-10-09T19:05:00Z", kind: "STOCK_CONFIRMED", summary: "Centre confirmed 1 unit (simulated)", actorRole: "BLOOD_CENTRE_STAFF" },
  ],
};

export function createMockDataSource(): CopilotDataSource {
  const byId = new Map(REQUESTS.map((r) => [r.id, r]));
  return {
    async getOpenRequests() {
      return REQUESTS.filter((r) => r.status !== "CLOSED").map((r) => ({ ...r }));
    },
    async getRequest(requestId) {
      const found = byId.get(requestId);
      return found ? { ...found } : null;
    },
    async searchCentres(requestId) {
      return byId.has(requestId) ? CENTRES.map((c) => ({ ...c, stock: c.stock ? { ...c.stock } : null })) : [];
    },
    async rankDonors(requestId, limit) {
      return byId.has(requestId) ? DONORS.slice(0, limit).map((d) => ({ ...d, reasons: [...d.reasons] })) : [];
    },
    async getCaseEvents(requestId) {
      return (EVENTS[requestId] ?? []).map((e) => ({ ...e }));
    },
  };
}
