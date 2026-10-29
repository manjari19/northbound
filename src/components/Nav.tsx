"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/postings/", label: "Postings" },
  { href: "/tracker/", label: "Tracker" },
  { href: "/review/", label: "Résumé" },
  { href: "/prep/", label: "Interview prep" },
];

export function Mark({ size = 22 }: { size?: number }) {
  // A compass needle pointing north
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.8 15.2 12H8.8Z" fill="currentColor" />
      <path d="M12 20.2 8.8 12h6.4Z" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

export function Arrow() {
  return (
    <svg className="arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M8 7h9v9" />
    </svg>
  );
}

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="wordmark" aria-label="northbound home">
          <Mark />
          northbound
        </Link>
        <nav className="navlinks" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={path?.startsWith(l.href.slice(0, -1)) ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/postings/" className="btn white nav-cta">
          Find roles <Arrow />
        </Link>
      </div>
    </header>
  );
}
