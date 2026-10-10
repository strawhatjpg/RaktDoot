"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Me } from "./ui.tsx";

export const REF_KEY = "raktdoot_ref";

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(() => { api<Me>("/api/auth/session").then(setMe).catch(() => setMe({ signedIn: false, methods: { google: false, whatsapp: false, demo: false } })); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  // After sign-in, attach a pending referral (from /r/<code>) exactly once.
  useEffect(() => {
    if (!me?.signedIn || !me.methods.rewards) return;
    const code = window.localStorage.getItem(REF_KEY);
    if (!code) return;
    window.localStorage.removeItem(REF_KEY);
    void api("/api/rewards/referral", { method: "POST", body: { code } }).catch(() => undefined);
  }, [me]);
  return { me, refresh };
}