// Owner: M1 (identity proof) on M2's User table.
// Called ONLY after WhatsApp has proven the phone number (LOGIN code sent from that number).
// New users are always REQUESTER: staff roles are never self-assigned (docs/USER_ROLES.md).
import { getDb } from "../db.ts";

export async function findOrCreateUserByPhone(phone: string): Promise<{ id: string }> {
  if (!/^\+\d{8,15}$/.test(phone)) throw new Error("phone must be E.164");
  return getDb().user.upsert({
    where: { phone },
    update: {},
    create: { phone, name: "WhatsApp user", role: "REQUESTER" },
    select: { id: true },
  });
}
