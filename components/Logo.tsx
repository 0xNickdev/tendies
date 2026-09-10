/* Brand assets, generated in Flow and keyed to transparent PNGs:
   - logo-mark.png — the gradient chip with the tender
   - wordmark.png  — the horizontal lockup (mark + TENDIES.)
   Both are alpha-cut, so they sit on any surface without a seam. */

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-mark.webp"
      alt=""
      aria-hidden
      className={`${className} select-none object-contain`}
      draggable={false}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/wordmark.webp"
      alt="Tendies"
      className={`h-7 w-auto select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
