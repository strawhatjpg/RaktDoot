"use client";
// Mobile app chrome: top bar + floating glass tab bar (families & donors).
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { isStaff } from "../lib/api.ts";
import { Brand } from "./Drop.tsx";
import { IconChart, IconHeart, IconHome, IconList, IconLogout, IconPlus } from "./icons.tsx";
import { useSession } from "./Session.tsx";

const TABS = [
  { href: "/home", label: "Home", Icon: IconHome },
  { href: "/request/new", label: "Request", Icon: IconPlus },
  { href: "/requests", label: "My cases", Icon: IconList },
  { href: "/donor", label: "Donate", Icon: IconHeart },
] as const;

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { me, signOut } = useSession();
  return (
    <>
      <div className="topbar">
        <div className="topbar-inner" style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
          <Link href="/home"><Brand /></Link>
          <div className="row" style={{ gap: 8 }}>
            {isStaff(me) && <Link href="/console" className="btn btn-ghost btn-sm"><IconChart width={16} /> Console</Link>}
            {me && <button className="icon-btn" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><IconLogout width={18} /></button>}
          </div>
        </div>
      </div>
      <main className="app-shell">{children}</main>
      <nav className="tabbar" aria-label="Primary">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/home" ? pathname === "/home" : pathname.startsWith(href) || (href === "/requests" && pathname.startsWith("/track"));
          return (
            <Link key={href} href={href} className="tab" aria-current={active ? "page" : undefined}>
              <Icon />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
