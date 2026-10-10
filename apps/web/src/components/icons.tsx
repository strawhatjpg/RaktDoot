// Inline SVG icon set (stroke icons, currentColor). No icon library dependency.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...props });

export const IconHome = (p: P) => <svg {...base(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-5h4v5" /></svg>;
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconList = (p: P) => <svg {...base(p)}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></svg>;
export const IconHeart = (p: P) => <svg {...base(p)}><path d="M12 21s-7.5-4.6-9.5-9.3C1 8.2 3.2 4.5 6.8 4.5c2 0 3.4 1 5.2 3 1.8-2 3.2-3 5.2-3 3.6 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z" /></svg>;
export const IconUser = (p: P) => <svg {...base(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
export const IconPin = (p: P) => <svg {...base(p)}><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const IconPhone = (p: P) => <svg {...base(p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconCheck = (p: P) => <svg {...base(p)}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
export const IconShield = (p: P) => <svg {...base(p)}><path d="M12 3 4.5 6v6c0 4.5 3.2 7.9 7.5 9 4.3-1.1 7.5-4.5 7.5-9V6L12 3z" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
export const IconSpark = (p: P) => <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" /></svg>;
export const IconChart = (p: P) => <svg {...base(p)}><path d="M3 20h18" /><path d="M6 16v-5M11 16V7M16 16v-8M21 16v-3" /></svg>;
export const IconChat = (p: P) => <svg {...base(p)}><path d="M4 5h16v11H8l-4 4V5z" /><path d="M8 9.5h8M8 12.5h5" /></svg>;
export const IconInbox = (p: P) => <svg {...base(p)}><path d="M4 13h4l1.5 3h5L16 13h4" /><path d="M5 5h14l1 8v6H4v-6l1-8z" /></svg>;
export const IconLogout = (p: P) => <svg {...base(p)}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></svg>;
export const IconArrow = (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconBack = (p: P) => <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const IconMic = (p: P) => <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const IconWand = (p: P) => <svg {...base(p)}><path d="m4 20 10-10M14 4v3M18.5 5.5l-2 2M20 10h-3M12.5 6.5 17.5 11.5" /></svg>;
export const IconBolt = (p: P) => <svg {...base(p)}><path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3z" /></svg>;
export const IconRefresh = (p: P) => <svg {...base(p)}><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4" /><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" /></svg>;
export const IconWhatsApp = (p: P) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.4.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z" />
  </svg>
);
