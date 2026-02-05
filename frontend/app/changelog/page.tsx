export default function ChangelogPage() {
  const entries = [
    {
      date: 'February 5, 2026',
      title: 'Policy Pages Added',
      items: [
        'Added Privacy Policy and Terms of Service pages.',
        'Aligned policy page header styling with the page background.',
      ],
    },
    {
      date: 'February 4, 2026',
      title: 'Operator HUD + STT Reliability',
      items: [
        'Broadcast-style Operator HUD layout and modernized controls.',
        'Improved end-of-line auto-advance reliability with adaptive triggers and debounce.',
        'Added ElevenLabs STT watchdog to recover from stale transcripts.',
      ],
    },
    {
      date: 'February 3, 2026',
      title: 'Profile Settings + Avatar System',
      items: [
        'Profile Settings page with sidebar layout.',
        'Avatar presets and device uploads with Supabase Storage.',
        'Dashboard header now reflects the saved avatar.',
      ],
    },
    {
      date: 'January 29, 2026',
      title: 'Premium UI Enhancements',
      items: [
        'Custom holographic date-time picker.',
        'Notification hover effects for Mission Control UI.',
        'Hum-to-Search UI components (visual layer).',
      ],
    },
    {
      date: 'January 25, 2026',
      title: 'Testing Infrastructure',
      items: [
        'Comprehensive unit, integration, and E2E testing setup.',
        'CI/CD pipeline stabilized for lint and type-checking.',
      ],
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <div className="container mx-auto px-6 pt-36 pb-16 max-w-4xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500 mb-3">Changelog</p>
        <h1 className="text-3xl md:text-4xl font-semibold mb-6">Product Updates</h1>
        <p className="text-sm text-slate-400 mb-10">
          The latest improvements to ParLeap, listed by date.
        </p>

        <div className="space-y-8">
          {entries.map((entry) => (
            <section
              key={`${entry.date}-${entry.title}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
            >
              <div className="flex flex-col gap-1 mb-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {entry.date}
                </p>
                <h2 className="text-lg font-semibold text-slate-100">{entry.title}</h2>
              </div>
              <ul className="space-y-2 text-sm text-slate-300">
                {entry.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-slate-500">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
