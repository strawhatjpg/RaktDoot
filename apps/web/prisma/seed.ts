import { BLOOD_GROUPS, CURRENT_TERMS_VERSION, coarsenCoordinates } from "@raktdoot/shared";
import { getDb } from "../src/server/db.ts";

if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
  throw new Error("Seed requires DEMO_MODE=true and a non-production environment. Use an isolated database.");
}

const db = getDb();
try {
  await db.$transaction(async (tx) => {
    for (let i = 1; i <= 2; i++) {
      const id = `demo-hospital-${i}`;
      await tx.hospital.upsert({ where: { id }, update: {}, create: { id, name: `FICTIONAL Demo Hospital ${i}`, district: i === 1 ? "Pune" : "Mumbai", lat: i === 1 ? 18.52 : 19.07, lng: i === 1 ? 73.85 : 72.87, isSimulated: true } });
    }
    const users = [
      { id: "demo-requester", name: "Demo Requester", role: "REQUESTER" as const, district: null, hospitalId: null },
      { id: "demo-other-requester", name: "Other Demo Requester", role: "REQUESTER" as const, district: null, hospitalId: null },
      { id: "demo-coordinator", name: "Demo Coordinator", role: "COORDINATOR" as const, district: "Pune", hospitalId: null },
      { id: "demo-hospital-staff", name: "Demo Hospital Staff", role: "HOSPITAL_STAFF" as const, district: "Pune", hospitalId: "demo-hospital-1" },
      { id: "demo-centre-staff", name: "Demo Centre Staff", role: "BLOOD_CENTRE_STAFF" as const, district: "Pune", hospitalId: null },
    ];
    for (const user of users) {
      await tx.user.upsert({ where: { id: user.id }, update: {}, create: { ...user, isSimulated: true, verifiedAt: user.role === "REQUESTER" ? null : new Date() } });
    }
    for (let i = 1; i <= 15; i++) {
      const id = `demo-centre-${i}`;
      await tx.bloodCentre.upsert({ where: { id }, update: {}, create: { id, name: `FICTIONAL Demo Blood Centre ${i}`, address: "Synthetic Pune location — not a real facility", district: "Pune", lat: 18.50 + i * 0.005, lng: 73.82 + i * 0.005, isSimulated: true } });
      for (const component of ["PACKED_RED_CELLS", "PLATELETS"] as const) {
        await tx.stockSnapshot.upsert({ where: { id: `${id}-${component}` }, update: {}, create: { id: `${id}-${component}`, centreId: id, bloodGroup: "B+", component, units: i % 5, source: "SYNTHETIC_SEED", isSimulated: true, recordedAt: new Date(Date.now() - i * 20 * 60_000) } });
      }
    }
    for (let i = 1; i <= 40; i++) {
      const id = `demo-donor-${i}`;
      const recentDonor = i % 4 === 0;
      await tx.user.upsert({ where: { id }, update: {}, create: { id, name: `Fictional Donor ${i}`, role: "REQUESTER", isSimulated: true, donorProfile: { create: { bloodGroup: BLOOD_GROUPS[(i - 1) % BLOOD_GROUPS.length], sex: i % 2 ? "MALE" : "FEMALE", availability: i % 5 ? "AVAILABLE" : "PAUSED", lastDonationAt: recentDonor ? new Date(Date.now() - 20 * 86_400_000) : null, lastDonationSource: recentDonor ? "SYNTHETIC_SEED" : null } } } });
      if (await tx.consent.count({ where: { userId: id } }) === 0) {
        await tx.consent.createMany({ data: [
          { userId: id, type: "TERMS", granted: true, source: "SYNTHETIC_SEED", termsVersion: CURRENT_TERMS_VERSION },
          { userId: id, type: "LOCATION_STORAGE", granted: true, source: "SYNTHETIC_SEED", termsVersion: CURRENT_TERMS_VERSION },
          { userId: id, type: "URGENT_ALERTS", channel: "APP_PUSH", granted: i % 3 !== 0, source: "SYNTHETIC_SEED", termsVersion: CURRENT_TERMS_VERSION },
        ] });
        await tx.donorLocation.upsert({ where: { userId: id }, update: {}, create: { userId: id, ...coarsenCoordinates({ lat: 18.51 + i * 0.002, lng: 73.84 + i * 0.002 }), areaLabel: "Synthetic Pune area", source: "MANUAL_ENTRY" } });
      }
    }
  }, { timeout: 30_000 });
  console.log("Seed ready: 2 fictional hospitals, 15 fictional centres, 40 fictional donors, 3 scoped staff. No phone numbers or login secrets seeded.");
} finally {
  await db.$disconnect();
}