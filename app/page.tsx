import { Header } from "@/components/landing/Header";
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
