import { HeroSection } from '@/components/landing/HeroSection'
import { ProblemFraming } from '@/components/landing/ProblemFraming'
import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { AIMoment } from '@/components/landing/AIMoment'
import { FeatureMarquee } from '@/components/landing/FeatureMarquee'
import { TestimonialWall } from '@/components/landing/TestimonialWall'
import { Pricing } from '@/components/landing/Pricing'
import { LyricWall } from '@/components/landing/LyricWall'
import { Footer } from '@/components/layout/Footer'

export default function Home() {
  return (
    <main className="min-h-screen bg-[#050505]">
      <HeroSection />
      <ProblemFraming />
      <FeatureGrid />
      <AIMoment />
      <FeatureMarquee />
      <LyricWall />
      <TestimonialWall />
      <Pricing />
      <Footer />
    </main>
  )
}
