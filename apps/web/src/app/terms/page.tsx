import type { ReactNode } from "react";

const P = ({ children }: { children: ReactNode }) => <p style={{ lineHeight: 1.5 }}>{children}</p>;

export default function Terms() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1>Terms and privacy notice (version 2026-10-v1)</h1>
      <P>RaktDoot helps families find licensed blood centres and, for verified requests, asks nearby volunteer donors on WhatsApp whether they can help. It is not an emergency or medical service and makes no clinical decisions. Follow your treating hospital&apos;s guidance.</P>
      <P>Accepting these terms lets us create your account. Each other use of your data needs its own permission, asked separately and withdrawable at any time: urgent WhatsApp alerts, donation reminders, storing your approximate area (rounded to about 1 km), and — only when you accept a specific request — sharing your contact with that request&apos;s coordinators.</P>
      <P>Donations happen only at licensed blood centres, whose staff decide eligibility. Dates we show are provisional reminders, not medical advice. We never pay donors or sell data. Type STOP on WhatsApp to stop alerts, or DELETE MY DATA to erase your profile.</P>
      <P>This prototype was built for a hackathon. Demo hospitals, centres, stock and donors are fictional.</P>
      <a href="/">Back</a>
    </main>
  );
}