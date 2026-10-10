"use client";
// Session context: loads /api/auth/me once and exposes refresh/sign-out to every page.
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiFailure } from "../lib/api.ts";
import type { Me } from "../lib/types.ts";

interface SessionValue {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue>({ me: null, loading: true, refresh: async () => null, signOut: async () => {} });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const user = await api.me();
      setMe(user);
      return user;
    } catch (e) {
      if (!(e instanceof ApiFailure) || e.status === 401) setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setMe(null);
    router.push("/");
  }, [router]);

  useEffect(() => { void refresh(); }, [refresh]);

  return <Ctx.Provider value={{ me, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);

/** Redirects to /login (with return path) once we know there is no session. */
export function useRequireSession(): SessionValue {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!session.loading && !session.me) {
      router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
  }, [session.loading, session.me, router]);
  return session;
}
