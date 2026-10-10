"use client";
import { useSession } from "../Session.tsx";

/** Staff district (coordinators are scoped to one). Falls back to the demo city. */
export function useDistrict(): string {
  const { me } = useSession();
  return me?.district ?? "Pune";
}
