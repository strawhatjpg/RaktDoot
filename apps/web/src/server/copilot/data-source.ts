// Owner: M3. DB-backed CopilotDataSource scoped to the signed-in staff member.
// Reuses M2's access rules (canAccessHospitalCases) and discovery; never widens access.
import type { CaseEventDTO, CopilotDataSource } from "@raktdoot/copilot";
import { canAccessHospitalCases, type ActorContext, type BloodRequestDTO, type MatchCandidateDTO } from "@raktdoot/shared";
import { discoverCentres } from "../centres/discovery.ts";
import { getDb } from "../db.ts";
import { previewMatches } from "../outreach/service.ts";

const OPEN_LIMIT = 50;

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows(where: object) {
  return getDb().bloodRequest.findMany({
    where,
    include: { hospital: true },
    orderBy: { createdAt: "desc" },
    take: OPEN_LIMIT,
  });
}

function toDto(row: Row): BloodRequestDTO {
  return {
    id: row.id,
    isSimulated: row.isSimulated,
    status: row.status,
    verification: row.verification,
    outcome: row.outcome,
    hospitalId: row.hospitalId,
    hospitalName: row.hospital.name,
    bloodGroup: row.bloodGroup as BloodRequestDTO["bloodGroup"],
    component: row.component,
    units: row.units,
    neededBy: row.neededBy.toISOString(),
    language: row.language as BloodRequestDTO["language"],
    createdAt: row.createdAt.toISOString(),
  };
}

/** Prisma filter for the cases this staff member may see (mirrors canAccessHospitalCases). */
function scopeFilter(actor: ActorContext): object | null {
  if (!actor.verified) return null;
  if (actor.role === "ADMIN") return {};
  if (actor.role === "HOSPITAL_STAFF" && actor.hospitalId) return { hospitalId: actor.hospitalId };
  if (actor.role === "COORDINATOR" && actor.district) return { hospital: { district: actor.district } };
  return null; // centre staff: only via future case assignments
}

export function createDbDataSource(actor: ActorContext): CopilotDataSource {
  const scope = scopeFilter(actor);

  async function readable(requestId: string): Promise<Row | null> {
    const row = await getDb().bloodRequest.findUnique({ where: { id: requestId }, include: { hospital: true } });
    if (!row || !canAccessHospitalCases(actor, row.hospitalId, row.hospital.district)) return null;
    return row;
  }

  return {
    async getOpenRequests() {
      if (scope === null) return [];
      return (await loadRows({ ...scope, status: { not: "CLOSED" } })).map(toDto);
    },

    async getRequest(requestId) {
      const row = await readable(requestId);
      return row ? toDto(row) : null;
    },

    async searchCentres(requestId) {
      const row = await readable(requestId);
      if (!row || row.component === "UNKNOWN") return [];
      const params = new URLSearchParams({ hospitalId: row.hospitalId, bloodGroup: row.bloodGroup, component: row.component });
      return (await discoverCentres(params)).centres;
    },

    async rankDonors(requestId, limit): Promise<MatchCandidateDTO[]> {
      // M2's explainable matching, scoped to this staff member. Unverified requests
      // are ranked for preview only; outreach still requires verification.
      const row = await readable(requestId);
      if (!row) return [];
      const { candidates } = await previewMatches(actor, requestId, 1);
      return candidates.slice(0, Math.max(0, Math.min(limit, 20)));
    },

    async getCaseEvents(requestId): Promise<CaseEventDTO[]> {
      const row = await readable(requestId);
      if (!row) return [];
      const events = await getDb().requestEvent.findMany({
        where: { requestId },
        include: { actor: { select: { role: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return events.map((e) => ({
        at: e.createdAt.toISOString(),
        kind: "STATUS_CHANGED",
        summary: `${e.fromStatus ?? "NEW"} → ${e.toStatus}`,
        actorRole: e.actor.role,
      }));
    },
  };
}
