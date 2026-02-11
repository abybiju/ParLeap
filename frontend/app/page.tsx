import { HeroSection } from '@/components/landing/HeroSection'
import { ProblemFraming } from '@/components/landing/ProblemFraming'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { AIMoment } from '@/components/landing/AIMoment'
import { LiveConsoleShowcase } from '@/components/landing/LiveConsoleShowcase'
import { FeatureMarquee } from '@/components/landing/FeatureMarquee'
import { TestimonialWall } from '@/components/landing/TestimonialWall'
import { Pricing } from '@/components/landing/Pricing'
import { LyricWall } from '@/components/landing/LyricWall'
import { ScriptureSection } from '@/components/landing/ScriptureSection'
import { Footer } from '@/components/layout/Footer'

export default function Home() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <ProblemFraming />
      <FeatureGrid />
      <AIMoment />
      <LiveConsoleShowcase />
      <FeatureMarquee />
      <LyricWall />
      <ScriptureSection />
      <TestimonialWall />
      <Pricing />
      <Footer />
    </main>
  )
}
