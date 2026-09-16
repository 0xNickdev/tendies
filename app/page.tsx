import { Header } from "@/components/landing/Header";
import { ArrowRail } from "@/components/landing/ArrowRail";
import { Magnetic } from "@/components/landing/Magnetic";
import { Roadmap } from "@/components/landing/Roadmap";
import { LiveTicker } from "@/components/landing/LiveTicker";
import { Hero } from "@/components/landing/Hero";
import {
  About,
  FAQ,
  Footer,
  FooterCTA,
  Mechanics,
  Mission,
  Stats,
} from "@/components/landing/Sections";

export default function LandingPage() {
  return (
    <main className="relative">
      <ArrowRail />
      <Magnetic />
      <Header />
      <Hero />
      <LiveTicker />
      <About />
      <Mission />
      <Mechanics />
      <Roadmap />
      <Stats />
      <FAQ />
      <FooterCTA />
      <Footer />
    </main>
  );
}
