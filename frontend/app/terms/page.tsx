'use client'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto px-6 py-16 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-3">Terms</p>
        <h1 className="text-3xl md:text-4xl font-semibold mb-6">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: February 5, 2026</p>

        <section className="space-y-6 text-sm leading-relaxed text-slate-300">
          <p>
            These Terms of Service govern your use of ParLeap. By using our services,
            you agree to these terms. If you do not agree, please do not use the service.
          </p>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Use of Service</h2>
            <p>
              You may use ParLeap only in compliance with applicable laws and regulations.
              You are responsible for the content you upload and for maintaining the
              security of your account.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Subscriptions & Billing</h2>
            <p>
              Paid plans, if offered, will be billed according to the plan you select.
              Subscription details and pricing will be disclosed at the time of purchase.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Intellectual Property</h2>
            <p>
              ParLeap and its content, software, and branding are protected by
              intellectual property laws. You retain rights to your own content.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Service Availability</h2>
            <p>
              We strive to keep the service available but do not guarantee uninterrupted
              access. We may modify or discontinue features at any time.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Limitation of Liability</h2>
            <p>
              ParLeap is provided “as is.” To the maximum extent permitted by law, we are
              not liable for indirect, incidental, or consequential damages.
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-base font-semibold text-slate-100">Contact</h2>
            <p>
              Questions about these terms? Contact us at <span className="text-slate-200">support@parleap.com</span>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
