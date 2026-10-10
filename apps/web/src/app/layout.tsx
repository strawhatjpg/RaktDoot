import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "../components/Session.tsx";
import { ToastProvider } from "../components/Toast.tsx";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "RaktDoot — right blood, right place, right time", template: "%s · RaktDoot" },
  description: "Request blood in your language, see nearby licensed blood centres instantly, and track your case. Donors are alerted on WhatsApp only for verified needs.",
  applicationName: "RaktDoot",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "RaktDoot", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0507",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}