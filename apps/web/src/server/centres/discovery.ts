import { BLOOD_COMPONENTS, BLOOD_GROUPS, haversineKm, type CentreResultDTO, type HospitalDTO } from "@raktdoot/shared";
import type { BloodComponent } from "@prisma/client";
import { getDb } from "../db.ts";
import { ApiError } from "../http.ts";

export async function listHospitals(): Promise<HospitalDTO[]> {
  return getDb().hospital.findMany({ select: { id: true, name: true, district: true, isSimulated: true }, orderBy: { name: "asc" }, take: 100 });
}

export async function discoverCentres(params: URLSearchParams): Promise<{ centres: CentreResultDTO[]; distanceKind: "STRAIGHT_LINE"; hospitalId: string }> {
  const hospitalId = params.get("hospitalId");
  const bloodGroup = params.get("bloodGroup");
  const component = params.get("component");
  if (!hospitalId || !(BLOOD_GROUPS as readonly unknown[]).includes(bloodGroup) || !(BLOOD_COMPONENTS as readonly unknown[]).includes(component) || component === "UNKNOWN") {
    throw new ApiError(400, "VALIDATION_ERROR", "Provide hospitalId, bloodGroup and a known component");
  }
  const db = getDb();
  const hospital = await db.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw new ApiError(404, "NOT_FOUND", "Hospital not found");
  const rows = await db.bloodCentre.findMany({
    where: { district: hospital.district },
    include: { snapshots: { where: { bloodGroup: bloodGroup!, component: component as BloodComponent }, orderBy: [{ recordedAt: "desc" }, { id: "desc" }], take: 1 } },
    take: 100,
    orderBy: { id: "asc" },
  });
  const centres = rows.map((row): CentreResultDTO => {
    const stock = row.snapshots[0];
    return {
      centreId: row.id, name: row.name, phone: row.phone ?? "", isSimulated: row.isSimulated,
      distanceKm: Math.round(haversineKm(hospital, row) * 10) / 10,
      stock: stock ? { units: stock.units, status: stock.status, updatedAt: stock.recordedAt.toISOString(), isSimulated: stock.isSimulated } : null,
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm || a.centreId.localeCompare(b.centreId));
  return { centres, distanceKind: "STRAIGHT_LINE", hospitalId };
}