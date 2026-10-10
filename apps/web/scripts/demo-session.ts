import { getDb } from "../src/server/db.ts";
import { createSession } from "../src/server/auth/session.ts";

if (process.env.DEMO_MODE !== "true" || process.env.NODE_ENV === "production") {
  throw new Error("Demo session creation is disabled. Requires DEMO_MODE=true outside production.");
}
const db = getDb();
try {
  const userId = process.argv[2] ?? "demo-requester";
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.isSimulated) throw new Error("Only seeded simulated users may receive demo sessions");
  const session = await createSession(userId);
  console.log(`Temporary local session for ${userId}; expires ${session.expiresAt.toISOString()}`);
  console.log(`Authorization: Bearer ${session.token}`);
  console.log("Treat this token as a secret. Do not commit, publish or include it in screenshots.");
} finally {
  await db.$disconnect();
}