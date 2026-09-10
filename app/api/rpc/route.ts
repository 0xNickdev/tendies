import { NextResponse } from "next/server";

// Server-side proxy to the Solana RPC.
//
// The endpoint URL carries a paid API key, so it must never reach the browser:
// anything named NEXT_PUBLIC_* is inlined into the client bundle and readable
// by every visitor. SOLANA_RPC stays server-only and the client talks to this
// route instead.
//
// Only read methods the app actually uses are forwarded — otherwise this is an
// open relay and someone else's app runs on our quota.

export const dynamic = "force-dynamic";

const UPSTREAM =
  process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";

const ALLOWED = new Set([
  "getTokenAccountsByOwner",
  "getTokenAccountBalance",
  "getBalance",
  "getAccountInfo",
  "getLatestBlockhash",
  "getHealth",
]);

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  // batched calls arrive as an array
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 10) {
    return NextResponse.json({ error: "batch too large" }, { status: 400 });
  }
  for (const call of calls) {
    const method = (call as { method?: string })?.method;
    if (!method || !ALLOWED.has(method)) {
      return NextResponse.json(
        { error: `method not allowed: ${method ?? "none"}` },
        { status: 403 },
      );
    }
  }

  try {
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unreachable" }, { status: 502 });
  }
}
