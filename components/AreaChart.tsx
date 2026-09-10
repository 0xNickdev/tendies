"use client";

import { useId } from "react";

type Point = { x: string; y: number };

export function AreaChart({
  data,
  height = 220,
  showDots = true,
  stroke = "#69AAC1",
}: {
  data: Point[];
  height?: number;
  showDots?: boolean;
  stroke?: string;
}) {
  const id = useId().replace(/:/g, "");
  const w = 720;
  const h = height;
  const padX = 16;
  const padY = 24;

  const ys = data.map((d) => d.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;

  const px = (i: number) =>
    padX + (i / (data.length - 1)) * (w - padX * 2);
  const py = (v: number) =>
    h - padY - ((v - min) / span) * (h - padY * 2);

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${px(i).toFixed(1)} ${py(d.y).toFixed(1)}`)
    .join(" ");
  const area = `${line} L ${px(data.length - 1).toFixed(1)} ${h - padY} L ${px(0).toFixed(1)} ${h - padY} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Price mark history"
    >
      <defs>
        <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* baseline grid */}
      {[0.25, 0.5, 0.75].map((g) => (
        <line
          key={g}
          x1={padX}
          x2={w - padX}
          y1={padY + g * (h - padY * 2)}
          y2={padY + g * (h - padY * 2)}
          stroke="rgba(151,252,228,0.07)"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill={`url(#fill-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {showDots &&
        data.map((d, i) => (
          <circle
            key={i}
            cx={px(i)}
            cy={py(d.y)}
            r={i === data.length - 1 ? 4 : 2.4}
            fill={i === data.length - 1 ? stroke : "#0A1110"}
            stroke={stroke}
            strokeWidth="1.6"
          />
        ))}
    </svg>
  );
}
