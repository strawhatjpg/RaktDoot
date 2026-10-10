/**
 * The bot's view of Member 2's backend. M2 implements this (DB / REST) at Sync 1;
 * until then the in-memory mock lets the whole bot run and be tested.
 */
import type {
  BloodComponent,
  BloodGroup,
  ConsentType,
  LanguageCode,
  LocationUpdateDTO,
  NotificationChannel,
  UserRole,
} from "@raktdoot/shared";
import { coarsenCoordinates } from "@raktdoot/shared";
import type { ConversationState } from "./conversation/state.ts";

export interface CreateRequestInput {
  requesterPhone: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  component: BloodComponent;
  units: number;
  neededBy: string | null;
  language: LanguageCode;
  originalText: string;
}

/**
 * createRequest returns this id when nothing was created (e.g. hospital not in the directory).
 * The bot then keeps the draft and asks for the hospital again. Any text after the first
 * line of `trackUrl` may carry example hospital names as "(e.g. A, B)".
 */
export const REQUEST_NOT_CREATED = "NOT CREATED";

export interface CoreApi {
  getState(phone: string): Promise<ConversationState | null>;
  saveState(phone: string, state: ConversationState): Promise<void>;
  upsertUser(phone: string, data: { language?: LanguageCode; role?: UserRole }): Promise<void>;
  recordConsent(phone: string, type: ConsentType, channel: NotificationChannel | null, granted: boolean, source: string): Promise<void>;
  createRequest(input: CreateRequestInput): Promise<{ id: string; trackUrl: string }>;
  updateDonor(phone: string, data: { bloodGroup?: BloodGroup }): Promise<void>;
  updateLocation(phone: string, location: LocationUpdateDTO): Promise<{ areaLabel: string }>;
  /** Donor reply to an outreach invite (M2 owns wave logic). */
  respondToInvite(phone: string, inviteId: string, response: "ACCEPT" | "DECLINE" | "PAUSE"): Promise<void>;
  requestStatus(phone: string): Promise<string | null>;
  requestDeletion(phone: string): Promise<void>;
}

export interface MockCoreApi extends CoreApi {
  readonly requests: CreateRequestInput[];
  readonly consents: Array<{ phone: string; type: ConsentType; channel: NotificationChannel | null; granted: boolean }>;
  readonly locations: Array<{ phone: string } & LocationUpdateDTO>;
  readonly inviteResponses: Array<{ phone: string; inviteId: string; response: string }>;
}

export function createMockCoreApi(baseUrl = "http://localhost:3000"): MockCoreApi {
  const states = new Map<string, ConversationState>();
  const requests: CreateRequestInput[] = [];
  const consents: MockCoreApi["consents"] = [];
  const locations: MockCoreApi["locations"] = [];
  const inviteResponses: MockCoreApi["inviteResponses"] = [];
  return {
    requests, consents, locations, inviteResponses,
    async getState(phone) { return states.get(phone) ?? null; },
    async saveState(phone, state) { states.set(phone, structuredClone(state)); },
    async upsertUser() {},
    async recordConsent(phone, type, channel, granted) { consents.push({ phone, type, channel, granted }); },
    async createRequest(input) {
      requests.push(input);
      const id = `RD-${String(1000 + requests.length)}`;
      return { id, trackUrl: `${baseUrl}/track/${id}` };
    },
    async updateDonor() {},
    async updateLocation(phone, loc) {
      // Typed areas arrive without coordinates (NaN); only real pins are coarsened.
      const hasPin = Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
      if (!hasPin) {
        locations.push({ phone, ...loc });
        return { areaLabel: loc.areaLabel ?? "your area" };
      }
      const coarse = coarsenCoordinates({ lat: loc.lat, lng: loc.lng });
      locations.push({ phone, ...loc, ...coarse });
      return { areaLabel: loc.areaLabel ?? `${coarse.lat}, ${coarse.lng}` };
    },
    async respondToInvite(phone, inviteId, response) { inviteResponses.push({ phone, inviteId, response }); },
    async requestStatus() { return requests.length ? "OPEN — awaiting verification" : null; },
    async requestDeletion() {},
  };
}