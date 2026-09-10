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
const DEEP = "#5C8394";

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
  // Real brand assets, served from this deployment - a card that doesn't look
  // like the site is worse than no card.
  const origin = new URL(req.url).origin;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: GROUND,
          position: "relative",
        }}
      >
        {/* the hero art, bled off the right edge */}
        <img
          src={`${origin}/card-art.png`}
          width={440}
          height={769}
          style={{ position: "absolute", right: -40, top: -70, opacity: 0.95 }}
          alt=""
        />

        {/* brand gradient hairline down the left edge */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: `linear-gradient(200deg, ${LIGHT}, ${STEEL} 55%, ${DEEP})`,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "58px 64px",
            width: 780,
          }}
        >
          <img src={`${origin}/card-wordmark.png`} width={232} height={65} alt="Tendies" />

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", color: MUTED, fontSize: 21, letterSpacing: 5 }}>
              KITCHEN RANK
            </div>
            <div
              style={{
                display: "flex",
                color: WHITE,
                fontSize: rank(streak).length > 12 ? 76 : 92,
                fontWeight: 800,
                letterSpacing: -3,
                lineHeight: 1.05,
                marginTop: 6,
              }}
            >
              {rank(streak)}
            </div>
          </div>

          <div style={{ display: "flex", gap: 56 }}>
            {[
              ["EPOCH STREAK", String(streak), WHITE],
              ["PAID OUT", `$${totalPaid.toFixed(2)}`, MINT],
              ["COOKING", choice ?? "—", LIGHT],
            ].map(([label, value, colour]) => (
              <div key={label} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", color: MUTED, fontSize: 18, letterSpacing: 3 }}>
                  {label}
                </div>
                <div
                  style={{
                    display: "flex",
                    color: colour,
                    fontSize: 46,
                    fontWeight: 800,
                    marginTop: 4,
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <div style={{ display: "flex", color: WHITE, fontSize: 30, fontWeight: 700 }}>
              I&apos;m cooking.
            </div>
            <div style={{ display: "flex", color: MUTED, fontSize: 18 }}>{short}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
