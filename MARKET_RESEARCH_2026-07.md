# ParLeap — Market & Competitive Research (July 2026)

**Compiled:** 2026-07-17 from six parallel research tracks (competitor deep-dive,
prior-art/threat scan, market shape + pricing, buying dynamics + pain points,
integrations + CCLI licensing, underserved segments + AI-demand). Vendor claims
are flagged where third-party verification was unavailable; Reddit was
un-fetchable so community sentiment leans on Capterra/SoftwareAdvice/GetApp
(2025–26 dated reviews) and church-tech blogs.

---

## 1. Bottom line

ParLeap's differentiators, graded against what actually ships in mid-2026:

| Bet | Verdict | Why |
|---|---|---|
| **STT lyric-following (auto-advance by listening to singing)** | **FIRST / most defensible** | No product demonstrably does continuous line-by-line lyric advance from live singing over a band mix. 2–3 rivals *claim* set-level song matching; none verified. Incumbents' only automation is track/MIDI-timed (useless for live-band churches, i.e. most small churches). |
| **Spoken Bible verse detection ("Smart Bible Listen")** | **LATE — commoditizing to $0** | 10+ shipping products since Aug 2025 (Loghema, Pewbeam, Kairos, WayPresenter, SmartVerses, VerseAir, WordCast, easybible…). Two are free-unlimited; one open-source; WayPresenter gives it away free. Cannot be the headline. |
| **Hum-to-search** | **UNIQUE but non-urgent** | Exists in no church product. No competitive pressure → validates keeping v2 paused (see `HUM_SEARCH_V3_PLAN.md`). |

**The empty intersection nobody occupies:** browser-native **+** live STT lyric-following that works for live bands (not just tracks) **+** multilingual (Spanish/Indic) display. That triple is ParLeap's whitespace.

**Strategic reframe:** the project has treated Smart Bible Listen as a premium feature and lyric-following as the base. The market says the opposite — **lead with the singing-follow operator + zero-install browser delivery; demote verse detection to a bundled feature** that wins only on noise-robustness under a live band (where competitors only demo clean sermon speech).

---

## 2. Competitive landscape

### Incumbents — none have any live-listening feature
- **ProPresenter** (Renewed Vision): category leader, desktop Mac/Win, rapid releases (v21.4, Jul 1 2026), **zero AI/STT**. **Subscription-only since Jul 30, 2024** ($29/mo, $289/yr seat; Campus $649/yr) — the single biggest switching catalyst in the market right now; verified review backlash on price from smaller churches. Mac-first in practice.
- **EasyWorship**: small/mid volunteer Windows churches; **EW8 is the first native Mac version** (arrived 2024–25 after long delays, eroded trust). Attendance-banded $210–330/yr. Auto-advance is audio-track-timed (2019), not listening.
- **MediaShout**: one-time $399–599 pricing (markets *against* subscriptions), Windows-first, **worst stability reputation** of the majors (weekly-crash complaints).
- **Proclaim (Logos)**: cloud-synced desktop, $250–930/yr. Has **real AI but post-production only** (transcripts, summaries, auto social clips) — not live.
- **SongBeamer**: German, one-time $124–299, no AI.
- **Free/OSS**: **FreeShow** is the standout — 501c3, **11,000+ new churches in 2025**, imports ProPresenter/EasyWorship/PowerPoint, added streaming in 2025. **WorshipTools Presenter** free + cloud-sync is the closest free product to ParLeap's cloud posture (but track-timed auto-advance, no listening). OpenLP active but dated; Quelea dormant.
- **Planning Center Services**: not a projector — the **scheduling hub everyone integrates with**. PCO integration is table stakes in the US.
- **Subsplash / Tithe.ly**: partners, not competitors (no projection product).

### The AI entrant cluster (2024–2026) — verse-first, desktop-first, Africa-first
7+ startups do live spoken-verse detection, several from a Nigerian dev cluster (profiled in Religion Unplugged, Apr 22 2026). Most credible / most traction:
- **Loghema** (ex-LogosAI): most traction — self-reported 16k downloads / 6k churches / 50+ countries; cloud STT 0.5s, paraphrase-aware, imports ProPresenter+EasyWorship libraries; ~$0–168/yr.
- **Kairos**: **closest stated concept to ParLeap's full vision** ("hears the worship set and pulls up the right lyrics"), fully offline, free–$165/yr — but unverified for actual lyric-following.
- **WayPresenter**: polished, global, **free verse detection** + "real-time sermon matching," $0–149/yr — undercuts everyone on price.
- **SmartVerses**: notable wedge — **augments ProPresenter** (native connection) instead of replacing it.
- **VerseAir**: US-priced ($149–299/yr), verse-first, congregation PWA.
- **WordCast Live**: claims lyric+verse auto-advance but drops Hillsong/Elevation logos at $7/mo — **almost certainly false**; treat claims skeptically.
- **easybible AI** & **Cloud of Worship**: the two genuinely **web-based** products — easybible sets a **$0 floor for web verse detection**; Cloud of Worship proves browser projection works at scale (no AI). Neither does lyric-following.

**Takeaway:** none have proven sung-lyric following (much harder than spotting a spoken "John 3:16"). The window is open but closing — ship the hard thing before a well-funded entrant bolts a speech-follow mode onto an existing STT pipeline.

---

## 3. Market shape (why the small-church wedge is real)

- **~373k US congregations; ~4.2M globally.** Barbell market: **~68% under 100 attendees** on a **median 70 people / $100k budget**, but the **top 13% (250+) hold 78% of all churchgoers** (ProPresenter-entrenched). ParLeap's "runs itself" wedge targets the volunteer-starved long tail; incumbents own the megachurch top.
- **Tailwinds:** 52% of church leaders increased tech budgets (2025, first-ever drop in cost-concern); **45% now use AI, up 80% YoY** — the "AI is scary" objection is fading. In-person attendance rose in 2025 for the first time in decades.
- **Volunteer crisis is pastors' #1 concern** (77%, Lifeway, ahead of reaching the unchurched) — the demand-side foundation for an "AI operator."
- **Presentation-software market:** ~$283M (2025) → ~$583M by 2033 (9.1% CAGR).
- **Evidence gaps:** no public market-share survey; % of churches on PowerPoint is inference only; no AV-volunteer-specific shortage stat. A quick r/churchtech or Facebook-group poll would fill these cheaply.

---

## 4. Pain points (ranked by evidence) → ParLeap's thesis validation

1. **Operator mistakes + last-minute setlist changes** — most-documented pain; an entire training-content genre exists for "when to change the slide." Sessler: the operator has "all the responsibility… yet no control to determine [the] time." Incumbents solve it only with human discipline. **STT-following dissolves it — the strongest differentiator theme found.**
2. **Volunteer training burden** — #1 complaint on every review site ("WAY too complicated," "terminology is 'Greek' to me," "steep learning curve"). ParLeap's core wedge.
3. **Subscription resentment** — the open switching window (ProPresenter's 2024 move).
4. **Mid-service crashes** — highest stakes; cuts both ways: a switching trigger *and* ParLeap's own credibility bar (a browser product must prove offline resilience or be disqualified on the same axis).
5. **Multi-screen / stage-display setup** & **streaming lower-thirds/NDI** — friction a browser architecture cheaply eliminates (tab-per-screen; OBS browser-source URL for lower thirds).
6. **Bilingual/multilingual** — underserved with proven spend: a whole third-party product (VerseBridge) exists just to align ES/EN slides for ProPresenter; interpreters cost $1,200–2,400/mo. No incumbent has a first-class dual-language mode.
7. **CCLI auto-reporting** — table stakes, but ParLeap has a **unique angle: STT knows what was *actually sung*** (repeats, audibles) → better ground-truth reporting than any incumbent.
8. **Migration lock-in** — trials die at migration; must import ProPresenter/EasyWorship/SongSelect/ChordPro or lose the deal.

The single sharpest demand quote (EasyWorship forum, small country church, ~Dec 2025): hand-timing auto-advance takes **"about an hour and a half or more, per song."** That is exactly the persona ParLeap's live-STT following eliminates.

---

## 5. Integrations & legal — the adoption gates and the landmines

### Must-haves (ranked)
- **Adoption-blocking:** Planning Center Services sync (open API, cheap to build, churches threaten to switch over it); SongSelect import (via the church's **own downloaded .txt/ChordPro files** — CCLI **closed its content API to new partners**: quoted $5k/yr + NDA, refused OpenLP); CCLI auto-reporting.
- **Strongly expected:** migration importers (ProPresenter/EasyWorship/OpenLyrics/ChordPro/text); livestream lyric output (OBS browser-source — easier than NDI in a web app; NDI+alpha still requested at production-heavy churches); stage display; a public control API (→ Bitfocus Companion/Stream Deck; tech directors demand a manual override even with an AI operator).
- **Nice-to-have:** Resi native, MIDI, ChMS sync, media-store integration.

### Legal landmines — architect around these from day one
1. **Never bundle copyrighted lyrics** — CCLI licenses churches, not vendors; lyrics enter via the church's own SongSelect downloads or manual entry.
2. **Never scrape SongSelect server-side as a SaaS** — kills any future CCLI partnership (OpenLP precedent).
3. **Never bundle NIV/ESV** without a license — build Bible support **per-translation from day one**; default to public-domain WEB/KJV + API.Bible Pro for copyrighted translations (ESV API is non-commercial/solo-dev-excluded; NIV commercial use is unavailable).
4. **Always render the per-song CCLI footer** with the *church's* license number.
5. **Collect the church's CCLI number at onboarding**; surface that a Streaming License is the church's responsibility.

**Strategic read:** the closed SongSelect content API is the incumbents' biggest external moat; **PCO's open API is the biggest open door**; and **CCLI auto-reporting is ParLeap's natural wedge into a CCLI relationship** because STT provides "what was actually sung" — a uniquely strong pitch no incumbent can match.

---

## 6. Underserved segments
- **Small churches with no tech volunteers** — strongest demand (pastors' #1 concern; the 1.5hr/song quote). "It runs itself" resonates, but must survive the crash-credibility bar.
- **US Hispanic Protestant** — ~30% need dual-language display (18% all-bilingual + 12% separate-language); segment growing; **no incumbent markets Spanish STT-following or side-by-side ES/EN lyrics.**
- **Africa** — real, but already locally served at ₦4,500–37,000/mo with mobile-money billing; a US entrant competes on reliability, not price.
- **India/Kerala (Malayalam/Tamil/Hindi)** — served by free VerseVIEW-class tools; no product anywhere claims Indic-language live lyric-following (relevant given ParLeap's own context).
- Korean/Chinese diaspora, house churches, multi-site: thin/uncovered — flagged for later primary research.

---

## 7. Pricing guidance
- Small-church software wallet ≈ **$400–900/yr total** (CCLI $200–300 non-negotiable + presentation $0–330 + PCO $0–360). Above ~$25–30/mo, ParLeap competes with a <100-attendee church's *entire remaining* wallet.
- Anchors: ProPresenter seat $289/yr is the software ceiling; EasyWorship $210–330/yr the volunteer-church band. Verse detection is racing to $0.
- **Don't price against "labor replacement"** (churches don't pay cash for volunteers) — price in the **$15–40/mo** band between EasyWorship and ProPresenter, on the reliability of the full listening loop + web UX.
- The pricing shape churches accept as fair: **generous free tier + attendance-banded pricing** (CCLI and EasyWorship band by attendance; PCO's freemium is beloved; MediaShout wins a segment on one-time pricing).

---

## 8. Top 10 gaps ParLeap can fill (ranked by evidence strength)

1. **Reliable live lyric-following for live-band churches** — the empty space; incumbents only automate with tracks/MIDI. *(Finish this. It is the moat.)*
2. **Zero-install browser operator + projector** — sidesteps Mac/PC split, multi-screen OS plumbing, and install friction in one architectural choice.
3. **Planning Center Services sync** — adoption-blocking, cheap, open API.
4. **Migration importers** (ProPresenter/EasyWorship/SongSelect/ChordPro) — trials die without them.
5. **OBS browser-source lower-thirds + stage display** — cheap web-native wins on documented pain.
6. **Side-by-side bilingual display (ES/EN first, Indic next)** — proven spend, no incumbent answer.
7. **CCLI auto-reporting via "what was actually sung"** — table-stakes feature with a unique STT-powered angle; the wedge into a CCLI relationship.
8. **Crash-resilience / offline fallback** — not a feature but the credibility bar a cloud product must clear to win the anti-crash switchers.
9. **Public control API** (→ Companion/Stream Deck) — manual override tech directors demand alongside the AI.
10. **Smart Bible Listen as a robust bundled feature** — keep it, but win on noise-robustness under a live band, not on "it exists."

---

## 9. Recommended focus (synthesis)
1. **Finish and harden the lyric-follower.** It is the only defensible moat and the window is closing. Robustness under band noise is the whole game.
2. **Reframe positioning** around "the operator that listens" + browser-native, not verse detection.
3. **Build the adoption gates** in parallel: PCO sync, SongSelect file import, migration importers, OBS lower-thirds. Without these, the AI never gets evaluated.
4. **Demote Smart Bible Listen** to a bundled feature; re-enable it only when it's noise-robust — it's now table stakes, not a headline.
5. **Keep hum-search paused** (no competitive pressure) — resume per `HUM_SEARCH_V3_PLAN.md` only after the eval harness proves a matcher.
6. **Add bilingual display** as the next real differentiator once the core loop is solid.
7. **Price $15–40/mo, attendance-banded, generous free tier.** Don't exceed a small church's remaining wallet.

*All product claims vendor-stated unless a third-party source is cited; traction numbers for AI entrants are self-reported. Sources inline in the underlying research (2026-07-16/17).*
