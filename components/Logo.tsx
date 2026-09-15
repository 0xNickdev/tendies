/* Brand mark — the hooded-archer image (dark figure on neon lime). */
export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.jpg"
      alt=""
      aria-hidden
      className={`${className} rounded-md object-cover`}
    />
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark />
      <span className="font-black uppercase tracking-tight text-[15px] text-zinc-100">
        Robin<span className="text-robin">X</span>
        <span className="text-robin">.</span>
      </span>
    </span>
  );
}
