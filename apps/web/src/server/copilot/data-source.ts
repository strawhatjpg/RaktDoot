// Owner: M3. DB-backed CopilotDataSource scoped to the signed-in staff member.
// Reuses M2's access rules (canAccessHospitalCases) and discovery; never widens access.
import type { CaseEventDTO, CopilotDataSource } from "@raktdoot/copilot";
import { canAccessHospitalCases, type ActorContext, type BloodRequestDTO, type MatchCandidateDTO } from "@raktdoot/shared";
import { discoverCentres } from "../centres/discovery.ts";
import { getDb } from "../db.ts";

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

    async rankDonors(): Promise<MatchCandidateDTO[]> {
      // M2's matching runtime is not built yet. Returning nothing is safer than an
      // unreviewed ranking; the tool tells the coordinator that matching is pending.
      return [];
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
