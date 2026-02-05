'use client'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto px-6 pt-36 pb-16 max-w-4xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-3">Privacy</p>
        <h1 className="text-3xl md:text-4xl font-semibold mb-6">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: February 5, 2026</p>

        <section className="space-y-6 text-sm leading-relaxed text-slate-300">
          <p>
            This Privacy Policy explains how ParLeap collects, uses, and protects
            information when you use our services. By using ParLeap, you agree to
            the practices described below.
          </p>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Information We Collect</h2>
            <p>
              We collect account information you provide (such as email and profile
              details), usage data related to how you interact with the platform,
              and technical data such as device and browser information.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">How We Use Information</h2>
            <p>
              We use information to operate the service, improve performance, provide
              customer support, and secure the platform. We do not sell your personal
              information.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Audio & Transcripts</h2>
            <p>
              ParLeap processes live audio and transcripts to power real-time features.
              We only process data necessary to deliver the service and do not use
              your content for unrelated purposes.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Data Retention</h2>
            <p>
              We retain data only as long as necessary to provide the service or comply
              with legal obligations. You may request deletion of your account data.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Security</h2>
            <p>
              We use industry-standard security measures to protect data, but no system
              can guarantee absolute security.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Contact</h2>
            <p>
              For privacy questions, contact us at <span className="text-slate-200">support@parleap.com</span>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
