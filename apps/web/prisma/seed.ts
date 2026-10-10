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
  // Fictional sponsors and coupon codes for the rewards demo (shown only with FEATURE_TOKEN_REWARDS=true).
  await db.$transaction(async (tx) => {
    const sponsors = [
      { id: "demo-sponsor-cafe", name: "Demo Café (fictional)", items: [{ id: "demo-item-coffee", title: "Free filter coffee", description: "One filter coffee at any Demo Café outlet.", costCoins: 50, prefix: "CAFE" }] },
      { id: "demo-sponsor-pharmacy", name: "Demo Pharmacy (fictional)", items: [{ id: "demo-item-pharmacy", title: "10% off health essentials", description: "10% off one bill of up to ₹500.", costCoins: 100, prefix: "PHARMA" }] },
      { id: "demo-sponsor-cinema", name: "Demo Cinemas (fictional)", items: [{ id: "demo-item-movie", title: "Movie ticket", description: "One weekday 2D movie ticket.", costCoins: 250, prefix: "MOVIE" }] },
    ];
    for (const s of sponsors) {
      await tx.sponsor.upsert({ where: { id: s.id }, update: {}, create: { id: s.id, name: s.name, isSimulated: true } });
      for (const it of s.items) {
        await tx.storeItem.upsert({ where: { id: it.id }, update: {}, create: { id: it.id, sponsorId: s.id, title: it.title, description: it.description, costCoins: it.costCoins, isSimulated: true } });
        for (let n = 1; n <= 20; n++) {
          const code = `DEMO-${it.prefix}-${String(n).padStart(4, "0")}`;
          await tx.couponCode.upsert({ where: { itemId_code: { itemId: it.id, code } }, update: {}, create: { itemId: it.id, code } });
        }
      }
    }
  }, { timeout: 30_000 });
  console.log("Seed ready: 2 fictional hospitals, 15 fictional centres, 40 fictional donors, 3 scoped staff, 3 fictional sponsors with 60 demo coupons. No phone numbers or login secrets seeded.");
} finally {
  await db.$disconnect();
}