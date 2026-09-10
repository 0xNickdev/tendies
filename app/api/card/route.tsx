import { ImageResponse } from "next/og";
import { KEEPER_URL } from "@/lib/config";

// The shareable artifact: a card a holder posts to X. Every figure on it is
// measured by the keeper - nothing here is a badge we made up.

export const runtime = "edge";

const GROUND = "#071013";
const LIGHT = "#ABC4CE";
const STEEL = "#78A9BF";
const WHITE = "#F3F8F8";
const MUTED = "#7E949B";
const MINT = "#3CE3AB";

// Ranks are earned in epochs held, which is time in the kitchen - the one
// thing that can't be bought in a single transaction.
function rank(streak: number) {
  if (streak >= 336) return "TENDIES MASTER"; // a week of unbroken epochs
  if (streak >= 96) return "HEAD CHEF"; // two days
  if (streak >= 12) return "TENDIES COOK"; // six hours
  return "KITCHEN INTERN";
}

export async function GET(req: Request) {
  const owner = new URL(req.url).searchParams.get("owner") ?? "";

  let streak = 0;
  let totalPaid = 0;
  let choice: string | null = null;
  if (owner && KEEPER_URL) {
    try {
      const res = await fetch(`${KEEPER_URL}/account?owner=${encodeURIComponent(owner)}`, {
        cache: "no-store",
      });
      const json = await res.json();
      if (json?.ok) {
        streak = json.streak ?? 0;
        totalPaid = json.totalPaid ?? 0;
        choice = json.choice ?? null;
      }
    } catch {
      /* card still renders, just empty */
    }
  }

  const short = owner ? `${owner.slice(0, 4)}…${owner.slice(-4)}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: GROUND,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 11,
                background: `linear-gradient(215deg, ${LIGHT}, ${STEEL})`,
              }}
            />
            <div style={{ display: "flex", color: WHITE, fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              TENDIES
            </div>
          </div>
          <div style={{ display: "flex", color: MUTED, fontSize: 20, letterSpacing: 2 }}>{short}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: MUTED, fontSize: 22, letterSpacing: 4 }}>KITCHEN RANK</div>
          <div
            style={{ display: "flex", 
              color: LIGHT,
              fontSize: 96,
              fontWeight: 800,
              letterSpacing: -3,
              lineHeight: 1.05,
 }}
          >
            {rank(streak)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 72 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: MUTED, fontSize: 20, letterSpacing: 3 }}>EPOCH STREAK</div>
            <div style={{ display: "flex", color: WHITE, fontSize: 52, fontWeight: 800 }}>{streak}</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: MUTED, fontSize: 20, letterSpacing: 3 }}>PAID OUT</div>
            <div style={{ display: "flex", color: MINT, fontSize: 52, fontWeight: 800 }}>
              ${totalPaid.toFixed(2)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: MUTED, fontSize: 20, letterSpacing: 3 }}>COOKING</div>
            <div style={{ display: "flex", color: WHITE, fontSize: 52, fontWeight: 800 }}>{choice ?? "-"}</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", color: WHITE, fontSize: 30, fontWeight: 700 }}>I&apos;m cooking.</div>
          <div style={{ display: "flex", color: MUTED, fontSize: 20 }}>gettendies.vercel.app</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
