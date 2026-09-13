import type { Metadata } from "next";
import Link from "next/link";
import { CARD_VERSION } from "@/lib/config";

// The page a Chef Card link points at. Its only real job is to carry the
// OpenGraph tags, so X renders the card image inside the tweet.

const SITE = "https://gettendies.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string }>;
}): Promise<Metadata> {
  const { owner } = await params;
  const image = `${SITE}/api/card?owner=${encodeURIComponent(owner)}&v=${CARD_VERSION}`;
  const title = "My Tendies kitchen card";
  const description =
    "Holding $TENDIE and getting paid in real tokenized stocks every 30 minutes.";
  return {
    title,
    description,
    openGraph: { title, description, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function CardPage({
  params,
}: {
  params: Promise<{ owner: string }>;
}) {
  const { owner } = await params;
  return (
    <main className="mx-auto flex min-h-[100svh] max-w-4xl flex-col items-center justify-center gap-8 px-5 py-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/card?owner=${encodeURIComponent(owner)}&v=${CARD_VERSION}`}
        alt="Tendies kitchen card"
        className="w-full rounded-xl border border-tendie/15"
      />
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/terminal" className="btn-tendie !px-6 !py-3">
          Open the terminal
        </Link>
        <Link href="/" className="btn-ghost !px-6 !py-3">
          What is Tendies?
        </Link>
      </div>
    </main>
  );
}
