"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Logo";
import { useScrollY } from "@/lib/motion";

const NAV = [
  { label: "Markets", href: "#markets" },
  { label: "About", href: "#about" },
  { label: "Mission", href: "#mission" },
  { label: "Mechanics", href: "#mechanics" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
];

const X_URL = "https://x.com/Tendies_Stonk";

function XIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.66l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const scrollY = useScrollY();
  const [progress, setProgress] = useState(0);

  // how far down the page we are, 0..1 — drives the hairline under the header
  useEffect(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    setProgress(max > 0 ? Math.min(1, scrollY / max) : 0);
  }, [scrollY]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-200 ${
        scrolled
          ? "border-b border-tendie/30 bg-ink-950/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-mist-300 transition-colors hover:text-tendie"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Tendies on X"
            className="grid h-9 w-9 place-items-center rounded-md border border-tendie/40 text-mist-200 transition-colors hover:border-tendie hover:text-tendie"
          >
            <XIcon />
          </a>
          <Link
            href="/terminal"
            className="hidden sm:inline-flex btn-tendie !px-4 !py-2"
          >
            Enter Terminal
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-md border border-tendie/40 text-mist-200 md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              {open ? (
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* scroll progress hairline */}
      <div
        className="absolute inset-x-0 bottom-0 h-px origin-left bg-tendie/70"
        style={{ transform: `scaleX(${progress})`, opacity: scrolled ? 1 : 0 }}
        aria-hidden
      />

      {/* mobile menu */}
      {open && (
        <div className="border-t border-tendie/30 bg-ink-950/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 font-mono text-sm font-bold uppercase tracking-wider text-mist-200 hover:bg-tendie/5 hover:text-tendie"
              >
                {n.label}
              </a>
            ))}
            <Link
              href="/terminal"
              className="btn-tendie mt-2 w-full"
            >
              Enter Terminal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
