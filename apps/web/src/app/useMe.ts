"use client";
import { useCallback, useEffect, useState } from "react";
import { api, type Me } from "./ui.tsx";

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const refresh = useCallback(() => { api<Me>("/api/auth/session").then(setMe).catch(() => setMe({ signedIn: false, methods: { google: false, whatsapp: false, demo: false } })); }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { me, refresh };
}