"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Logo";

const NAV = [
  { label: "About", href: "#about" },
  { label: "Mission", href: "#mission" },
  { label: "Mechanics", href: "#mechanics" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "FAQ", href: "#faq" },
  { label: "Docs", href: "/docs" },
];

const X_URL = "https://x.com/robinxtech";

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
          ? "border-b-2 border-robin/30 bg-ink-950/80 backdrop-blur-xl"
          : "border-b-2 border-transparent"
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
              className="rounded-md px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:text-robin"
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
            aria-label="RobinX on X"
            className="grid h-9 w-9 place-items-center rounded-md border-2 border-robin/40 text-zinc-300 transition-colors hover:border-robin hover:text-robin"
          >
            <XIcon />
          </a>
          <Link
            href="/terminal"
            className="hidden sm:inline-flex btn-robin !px-4 !py-2"
          >
            Enter Terminal
          </Link>
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Menu"
            className="grid h-9 w-9 place-items-center rounded-md border-2 border-robin/40 text-zinc-300 md:hidden"
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

      {/* mobile menu */}
      {open && (
        <div className="border-t-2 border-robin/30 bg-ink-950/95 px-4 py-3 backdrop-blur-xl md:hidden">
          <div className="flex flex-col">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-3 font-mono text-sm font-bold uppercase tracking-wider text-zinc-300 hover:bg-robin/5 hover:text-robin"
              >
                {n.label}
              </a>
            ))}
            <Link
              href="/terminal"
              className="btn-robin mt-2 w-full"
            >
              Enter Terminal
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
