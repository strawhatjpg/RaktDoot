/**
 * Web simulator: same processInbound as WhatsApp, no Meta account needed (demo fallback).
 * M4's /simulator page POSTs SimulatorInput to /api/simulator and renders the replies.
 */
import type { InboundMessage, OutboundMessage } from "@raktdoot/shared";
import { processInbound, type BotDeps } from "../conversation/bot-flow.ts";

export interface SimulatorInput {
  from: string; // fake E.164, e.g. "+919800000001"
  text?: string;
  buttonId?: string;
  location?: { lat: number; lng: number; label?: string };
}

let counter = 0;

export function toInbound(input: SimulatorInput, now: Date = new Date()): InboundMessage {
  const base = { channel: "SIMULATOR" as const, from: input.from, messageId: `sim-${now.getTime()}-${++counter}`, receivedAt: now.toISOString() };
  if (input.buttonId) return { ...base, kind: "button", buttonId: input.buttonId };
  if (input.location) return { ...base, kind: "location", location: input.location };
  return { ...base, kind: "text", text: (input.text ?? "").slice(0, 2000) };
}

export async function simulate(input: SimulatorInput, deps: BotDeps): Promise<OutboundMessage[]> {
  if (!/^\+\d{8,15}$/.test(input.from)) throw new RangeError("from must be E.164, e.g. +919800000001");
  return processInbound(toInbound(input, deps.now?.()), deps);
}