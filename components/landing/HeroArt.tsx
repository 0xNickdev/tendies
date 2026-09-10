/* Hero backdrop — a basket of tenders, fanned out. Each strip is a short,
   chunky arc so it reads as breaded chicken rather than a line on a chart.
   Pure SVG: no image asset to ship. */
const STRIPS = [
  // d = spine of the strip, w = how thick it is fried, o = depth in the pile
  { d: "M120 300C126 250 158 214 206 198", w: 54, o: 0.42, r: -14 },
  { d: "M150 318C154 258 196 206 262 182", w: 62, o: 0.74, r: 2 },
  { d: "M196 322C212 268 258 222 318 206", w: 48, o: 0.52, r: 14 },
];

// breading, scattered along the strips
const SPECKS = [
  [148, 268, 4.5], [176, 232, 3.4], [206, 210, 3],
  [188, 286, 4], [224, 240, 3.6], [252, 206, 3],
  [236, 292, 3.4], [276, 246, 3], [300, 218, 2.6],
];

export function HeroArt({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 440 440" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="tendie-strip" x1="380" y1="90" x2="120" y2="340" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ABC4CE" />
          <stop offset="0.58" stopColor="#78A9BF" />
          <stop offset="1" stopColor="#5C8394" />
        </linearGradient>
      </defs>
      {STRIPS.map((s, i) => (
        <g key={i} transform={`rotate(${s.r} 220 250)`} opacity={s.o}>
          <path d={s.d} stroke="url(#tendie-strip)" strokeWidth={s.w} strokeLinecap="round" />
          {/* a darker crust edge along the underside */}
          <path
            d={s.d}
            stroke="#071013"
            strokeWidth={s.w}
            strokeLinecap="round"
            opacity="0.14"
            transform="translate(6 10)"
          />
        </g>
      ))}
      {SPECKS.map(([cx, cy, r], i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="#071013" opacity="0.35" />
      ))}
    </svg>
  );
}

/* ── Generated art (optional) ─────────────────────────────────────────────
   Drop the three PNGs from BRAND_PROMPTS.md into public/ and list them here;
   the hero swaps from the SVG to real layered art and each layer picks up its
   own parallax depth. Leave the array empty to keep the SVG. */
export const HERO_LAYERS: {
  src: string;
  depth: number;
  opacity?: number;
  scale?: number;
  blur?: number;
}[] = [
  // One generated plate, split into two planes: a soft, smaller copy sitting
  // deep behind, and the sharp one in front. They travel at different speeds,
  // so the parallax reads as depth rather than as a picture sliding around.
  { src: "/hero-tenders.webp", depth: 14, opacity: 0.3, scale: 0.82, blur: 3 },
  { src: "/hero-tenders.webp", depth: 44, opacity: 1 },
];

/* ── Generated video (optional) ───────────────────────────────────────────
   A Veo/Flow loop rendered on the brand ground (#071013). Veo has no alpha
   channel, so the clip is composited with `screen`: anything at ground level
   drops out and only the lit tenders survive. `poster` is a still frame, shown
   instead of the video under prefers-reduced-motion. */
export const HERO_VIDEO: { src: string; poster?: string } | null = null;
// export const HERO_VIDEO = { src: "/hero-loop.mp4", poster: "/hero-loop.jpg" };

/* The hero visual: video loop > layered PNGs > the inline SVG.
   `depth` comes from the Hero and turns a factor into a transform. */
export function HeroVisual({
  className = "",
  depth,
  reduced = false,
}: {
  className?: string;
  depth: (factor: number, scrollFactor?: number) => { transform: string } | undefined;
  reduced?: boolean;
}) {
  if (HERO_VIDEO) {
    return (
      <div className={`relative ${className}`} style={depth(30, 0.12)}>
        {reduced && HERO_VIDEO.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={HERO_VIDEO.poster}
            alt=""
            aria-hidden
            className="h-full w-full object-contain mix-blend-screen"
          />
        ) : (
          <video
            src={HERO_VIDEO.src}
            poster={HERO_VIDEO.poster}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
            className="h-full w-full object-contain mix-blend-screen"
          />
        )}
      </div>
    );
  }

  if (!HERO_LAYERS.length) {
    return (
      <div style={depth(38, 0.14)}>
        <HeroArt className={className} />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {HERO_LAYERS.map((layer, i) => (
        <div
          key={`${layer.src}-${i}`}
          className="absolute inset-0"
          style={{
            ...depth(layer.depth, layer.depth / 280),
            opacity: layer.opacity ?? 1,
            filter: layer.blur ? `blur(${layer.blur}px)` : undefined,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={layer.src}
            alt=""
            aria-hidden
            className="h-full w-full object-contain"
            style={layer.scale ? { transform: `scale(${layer.scale})` } : undefined}
          />
        </div>
      ))}
    </div>
  );
}
