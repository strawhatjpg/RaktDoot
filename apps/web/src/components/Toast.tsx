"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Toast = { id: number; text: string; error: boolean };
const Ctx = createContext<(text: string, opts?: { error?: boolean }) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, opts?: { error?: boolean }) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), text, error: !!opts?.error });
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && <div key={toast.id} role="status" aria-live="polite" className={`toast${toast.error ? " error" : ""}`}>{toast.text}</div>}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
