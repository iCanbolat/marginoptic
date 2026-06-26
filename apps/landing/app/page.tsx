import { Navbar } from "@/components/sections/navbar";
import { Hero } from "@/components/sections/hero";
import { NetProfit } from "@/components/sections/net-profit";
import { DashboardShowcase } from "@/components/sections/dashboard-showcase";
import { Integrations } from "@/components/sections/integrations";
import { ProductAnalysis } from "@/components/sections/product-analysis";
import { AiMcp } from "@/components/sections/ai-mcp";
import { Pricing } from "@/components/sections/pricing";
import { Cta } from "@/components/sections/cta";
import { Footer } from "@/components/sections/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <NetProfit />
        <DashboardShowcase />
        <Integrations />
        <ProductAnalysis />
        <AiMcp />
        <Pricing />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
