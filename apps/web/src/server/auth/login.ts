// Owner: M4 integration (uses M1's WhatsApp login + M2's sessions).
// One in-memory login-code store per server process, shared by the login routes and the bot,
// so "LOGIN 123456" sent from WhatsApp or the simulator confirms the code the app is polling.
import { createBotFromEnv, createMemoryLoginStore, createWhatsAppLogin, type LoginCodeStore } from "@raktdoot/bot";
import { getDb } from "../db.ts";
import { createSession, sessionCookie } from "./session.ts";

const g = globalThis as unknown as {
  raktdootLoginStore?: LoginCodeStore;
  raktdootBot?: ReturnType<typeof createBotFromEnv>;
};

export function loginStore(): LoginCodeStore {
  g.raktdootLoginStore ??= createMemoryLoginStore();
  return g.raktdootLoginStore;
}

export function whatsappLogin() {
  return createWhatsAppLogin(loginStore());
}

/** Bot instance for the web simulator. Uses M1's mock core until M2's adapter lands. */
export function simulatorBot() {
  g.raktdootBot ??= createBotFromEnv(process.env, { loginStore: loginStore() });
  return g.raktdootBot;
}

export function botNumber(): string {
  return process.env.WHATSAPP_BOT_NUMBER || "";
}

/** Finds or creates the requester account for a WhatsApp-verified phone, then opens a session. */
export async function sessionForPhone(phone: string): Promise<Response> {
  const user = await getDb().user.upsert({
    where: { phone },
    update: {},
    create: { phone, name: "RaktDoot user", role: "REQUESTER" },
  });
  return sessionResponse(user.id, { status: "confirmed" });
}

export async function sessionResponse(userId: string, body: unknown): Promise<Response> {
  const session = await createSession(userId);
  return Response.json(body, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Set-Cookie": sessionCookie(session.token, session.expiresAt),
    },
  });
}

export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true" && process.env.NODE_ENV !== "production";
}
