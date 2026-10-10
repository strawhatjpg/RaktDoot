import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { canAccessHospitalCases, canReadBloodRequest, isValidIdempotencyKey, validateCreateBloodRequest, type ActorContext, type BloodRequestDTO, type BloodRequestDetailDTO } from "@raktdoot/shared";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

type RequestWithHospital = Prisma.BloodRequestGetPayload<{ include: { hospital: true } }>;

function dto(row: RequestWithHospital): BloodRequestDTO {
  return { id: row.id, isSimulated: row.isSimulated, status: row.status, verification: row.verification, outcome: row.outcome, hospitalId: row.hospitalId, hospitalName: row.hospital.name, bloodGroup: row.bloodGroup as BloodRequestDTO["bloodGroup"], component: row.component, units: row.units, neededBy: row.neededBy.toISOString(), language: row.language as BloodRequestDTO["language"], createdAt: row.createdAt.toISOString() };
}

export async function createBloodRequest(actor: ActorContext, body: unknown, key: unknown): Promise<{ request: BloodRequestDTO; replayed: boolean }> {
  if (!isValidIdempotencyKey(key)) throw new ApiError(400, "INVALID_IDEMPOTENCY_KEY", "Provide an Idempotency-Key of 8–128 safe characters");
  // Replays remain valid after their deadline; all new requests are validated against now below.
  const structural = validateCreateBloodRequest(body, new Date(0));
  if (!structural.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the request fields", structural.fields);
  const payload = structural.value;
  const payloadHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  const db = getDb();
  const unique = { requesterId_idempotencyKey: { requesterId: actor.userId, idempotencyKey: key } };
  const replay = async () => {
    const existing = await db.bloodRequest.findUnique({ where: unique, include: { hospital: true } });
    if (!existing) return null;
    if (existing.payloadHash !== payloadHash) throw new ApiError(409, "IDEMPOTENCY_CONFLICT", "This key was already used with different request details");
    return { request: dto(existing), replayed: true };
  };
  const existing = await replay();
  if (existing) return existing;
  const validated = validateCreateBloodRequest(payload);
  if (!validated.ok) throw new ApiError(400, "VALIDATION_ERROR", "Check the request fields", validated.fields);
  const hospital = await db.hospital.findUnique({ where: { id: payload.hospitalId } });
  if (!hospital) throw new ApiError(400, "UNKNOWN_HOSPITAL", "Select a listed hospital");
  const verified = canAccessHospitalCases(actor, hospital.id, hospital.district);
  try {
    const row = await db.$transaction(async (tx) => {
      const created = await tx.bloodRequest.create({
        data: {
          requesterId: actor.userId, hospitalId: hospital.id, bloodGroup: payload.bloodGroup,
          component: payload.component, units: payload.units, neededBy: new Date(payload.neededBy),
          language: payload.language, status: "OPEN", verification: verified ? "VERIFIED" : "PENDING_REVIEW",
          isSimulated: hospital.isSimulated, idempotencyKey: key, payloadHash,
          // Draft conversation state belongs to M1 and was not persisted here.
          events: { create: { actorId: actor.userId, fromStatus: null, toStatus: "OPEN" } },
        }, include: { hospital: true },
      });
      await tx.auditLog.create({ data: { actorId: actor.userId, action: "REQUEST_CREATED", entity: "BloodRequest", entityId: created.id } });
      return created;
    });
    return { request: dto(row), replayed: false };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const result = await replay();
      if (result) return result;
    }
    throw error;
  }
}

export async function getBloodRequest(actor: ActorContext, id: string): Promise<BloodRequestDetailDTO> {
  const row = await getDb().bloodRequest.findUnique({ where: { id }, include: { hospital: true, events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
  if (!row || !canReadBloodRequest(actor, { requesterId: row.requesterId, hospitalId: row.hospitalId, district: row.hospital.district })) {
    throw new ApiError(404, "NOT_FOUND", "Request not found");
  }
  return { request: dto(row), events: row.events.map((event) => ({ id: event.id, fromStatus: event.fromStatus, toStatus: event.toStatus, createdAt: event.createdAt.toISOString() })) };
}

export async function listOwnRequests(actor: ActorContext): Promise<BloodRequestDTO[]> {
  const rows = await getDb().bloodRequest.findMany({ where: { requesterId: actor.userId }, include: { hospital: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return rows.map(dto);
}