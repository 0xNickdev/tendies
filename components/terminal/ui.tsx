"use client";

import { ReactNode } from "react";

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: "robin" | "long" | "short";
}) {
  const valColor =
    accent === "long"
      ? "text-long"
      : accent === "short"
        ? "text-short"
        : accent === "robin"
          ? "text-robin"
          : "text-white";
  return (
    <div className="panel p-5">
      <div className="label">{label}</div>
      <div className={`num mt-2 text-2xl font-black ${valColor}`}>{value}</div>
      {sub && <div className="mt-1 font-mono text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function ViewHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-3xl text-white">{title}</h1>
        {subtitle && (
          <p className="mt-1.5 font-mono text-sm text-zinc-500">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-md border-2 border-robin/40 bg-robin/5 text-robin">
        {icon}
      </div>
      <h3 className="text-lg font-black uppercase tracking-tight text-white">{title}</h3>
      <p className="mt-2 max-w-sm font-mono text-sm text-zinc-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border-2 border-robin/25 bg-ink-900/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded font-mono px-4 py-2 text-sm font-bold uppercase tracking-wide transition-all ${
            value === o.value
              ? "border-2 border-robin/50 bg-robin/15 text-robin"
              : "border-2 border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function LiveFeedChip({ label = "Live · Nasdaq feed" }: { label?: string }) {
  return (
    <span className="chip">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-long opacity-70" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-long" />
      </span>
      {label}
    </span>
  );
}
