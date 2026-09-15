"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

type Variant = "success" | "error" | "pending";
type Toast = { id: number; msg: string; variant: Variant };

const ToastCtx = createContext<{
  push: (msg: string, variant?: Variant) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const push = useCallback((msg: string, variant: Variant = "success") => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, msg, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3200);
  }, []);

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-24 left-1/2 z-[80] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex items-center gap-3 rounded-xl border border-robin/15 bg-ink-800/95 px-4 py-3 text-sm shadow-glow-sm backdrop-blur-xl"
          >
            <Dot variant={t.variant} />
            <span className="text-zinc-100">{t.msg}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

function Dot({ variant }: { variant: Variant }) {
  const color =
    variant === "success"
      ? "bg-long"
      : variant === "error"
        ? "bg-short"
        : "bg-warn";
  return (
    <span className={`h-2 w-2 shrink-0 rounded-full ${color}`}>
      {variant === "pending" && (
        <span className={`block h-2 w-2 animate-ping rounded-full ${color}`} />
      )}
    </span>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
