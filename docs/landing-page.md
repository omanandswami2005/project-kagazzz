# Kagaz — Landing Page Spec

> **Kagaz by Omni Docs.** The marketing landing page (web). Where a first-time visitor decides in 4 seconds whether to download.
>
> This document is the **design + content + animation + accessibility + agent** spec. An engineer can implement it directly from here.

---

## North Star

- **Time-to-understanding ≤ 4 seconds.** The visitor reads the hero, sees the marquee, and *knows* what Kagaz does without scrolling.
- **The "One Place" promise** is the emotional hook. The S-words marquee is the proof.
- **Trust before features.** "On-device AI · Offline-first · No account needed for V1" must be visible above the fold.

---

## Section 1 — Hero

### Visual layout (desktop, ≥ 1024px)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Kagaz                                       English / हिन्दी   Login│
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                                                  ┌─────────────────┐ │
│   Sab kagaj.                                     │                 │ │
│   Ek Jagah.                                      │                 │ │
│                                                  │   Phone mockup  │ │
│   All your papers, in one place.                 │   showing vault │ │
│                                                  │   + AI chat     │ │
│   ▸ [ Scan  ▸  Store  ▸  Search  ▸  Sign  ▸     │   floating in   │ │
│      Secure ▸ Share ▸ Speak ▸ Simplify ]         │   foreground    │ │
│      (animated marquee)                          │                 │ │
│                                                  │                 │ │
│   [ Get Kagaz — it's free ]   [ See how it works ]│                │ │
│                                                  │                 │ │
│   ★★★★★  Built for India · On-device AI ·        └─────────────────┘ │
│   Works offline · No account needed                                  │
└──────────────────────────────────────────────────────────────────────┘
```

### Visual layout (mobile, < 640px)

```
┌──────────────────────────┐
│ Kagaz       EN | हिं   ☰│
├──────────────────────────┤
│                          │
│  Sab kagaj.              │
│  Ek Jagah.               │
│                          │
│  All your papers,        │
│  in one place.           │
│                          │
│  ┌──────────────────┐    │
│  │ Scan · Store ·   │    │
│  │ Search · Sign ·  │    │
│  │ Secure · Share · │    │
│  │ Speak · Simplify │    │
│  └──────────────────┘    │
│   (marquee, scrolling)   │
│                          │
│  [ Get Kagaz — free ]    │
│  See how it works ▸      │
│                          │
│   📱 Phone mockup        │
│                          │
│  Built for India ·       │
│  On-device AI ·          │
│  Offline · No account    │
└──────────────────────────┘
```

### Copy

| Element | English | Hindi (Devanagari) | Notes |
|---|---|---|---|
| **Headline line 1** | `Sab kagaj.` | `सब कागज़।` | Romanized for the English variant; Devanagari for the Hindi variant. |
| **Headline line 2** *(highlighted)* | `Ek Jagah.` | `एक जगह।` | **One Place** is the emotional anchor — gets accent color and a soft underline animation on load. |
| **Subhead** | `All your papers, in one place.` | `आपके सारे दस्तावेज़, एक ही जगह।` | Sub-translation of the slogan, never a literal "all your *kagaj*". |
| **Primary CTA** | `Get Kagaz — it's free` | `Kagaz पाएँ — मुफ्त है` | Links to Play Store (Android primary). |
| **Secondary CTA** | `See how it works ▸` | `कैसे काम करता है ▸` | Scrolls to Section 4. |
| **Trust strip** | `Built for India · On-device AI · Works offline · No account needed` | `भारत के लिए · डिवाइस पर AI · ऑफलाइन · बिना अकाउंट` | Always visible above the fold. |

### Typography

| Element | Font | Size (desktop / mobile) | Weight | Color |
|---|---|---|---|---|
| Headline lines | `--font-primary` (Inter) | `--text-4xl` × 2 / `--text-3xl` × 1.5 | `--font-bold` | `--text-primary` |
| "Ek Jagah" / "एक जगह" | (same) | (same) | `--font-bold` | `--color-secondary` *(saffron accent)* |
| Subhead | `--font-primary` | `--text-xl` / `--text-lg` | `--font-medium` | `--text-secondary` |
| Hindi text | `--font-regional` (Noto Sans Devanagari) | (same as English siblings) | matched | (same) |
| Marquee S-words | `--font-primary` | `--text-2xl` / `--text-xl` | `--font-semibold` | `--color-primary` |
| Trust strip | `--font-primary` | `--text-sm` | `--font-regular` | `--text-muted` |

### The "Ek Jagah" highlight animation

The phrase `Ek Jagah.` / `एक जगह।` is the visual anchor.

- On load (after 200ms delay), a **saffron underline** wipes in left-to-right under the word, 400ms `--ease-emphasized`.
- On hover (desktop) or every 8s (mobile), a subtle **glow pulse** (300ms `ease-in-out`) cycles once.
- Respect `prefers-reduced-motion`: skip the wipe, keep the static color.

```css
.hero__highlight {
  color: var(--color-secondary);
  position: relative;
}
.hero__highlight::after {
  content: '';
  position: absolute;
  left: 0; bottom: -0.15em;
  height: 0.12em;
  width: 0;
  background: var(--color-secondary);
  border-radius: 4px;
  animation: wipe-in 400ms var(--ease-emphasized) 200ms forwards;
}
@keyframes wipe-in { to { width: 100%; } }
@media (prefers-reduced-motion: reduce) {
  .hero__highlight::after { animation: none; width: 100%; }
}
```

---

## Section 2 — The S-words marquee

The proof of the "One Place" promise. Each word is a real Kagaz feature.

### The eight words (in cycling order)

| # | Word | What it stands for inside Kagaz |
|---|---|---|
| 1 | **Scan** | Camera scanner with edge detection (Image Engine module) |
| 2 | **Store** | Encrypted local vault — SQLite + Capacitor Filesystem |
| 3 | **Search** | FTS5 full-text search over names, tags, and OCR'd text |
| 4 | **Sign** | Digital signature on PDFs (V2) |
| 5 | **Secure** | Per-file encryption, biometric lock, on-device only |
| 6 | **Share** | 5-digit-code share links with TTL (V2) |
| 7 | **Speak** | Voice-first AI Mitra in Hindi + English + Hinglish |
| 8 | **Simplify** | The whole point — government services made simple (V3) |

> Optional ninth word for Hindi-locale visitors: **Sahaj** (सहज — "easy"). Insert after *Simplify* when locale is `hi-IN`.

### Animation: chip rotation, not ticker

A horizontal ticker that *scrolls forever* feels cheap and is unreadable on mobile. Use **chip-cycling** instead.

```
Frame 1:   [ Scan ]  [ Store ]  [ Search ]  [ Sign ]   (4 visible)
              ↑
           active

Frame 2:   [ Store ] [ Search ] [ Sign ]    [ Secure ]
                                              ↑
                                           shifted in

(Every 1.8s, the leftmost chip slides out, the rest shift left, a new one slides in from the right.)
```

### Motion specifications

| Property | Value |
|---|---|
| Cycle interval | 1800ms |
| Slide duration | 600ms |
| Easing | `--ease-emphasized` |
| Active chip scale | 1.0 → 1.08 → 1.0 (subtle pulse, 600ms) |
| Inactive chip opacity | 0.55 |
| Active chip opacity | 1.0 |
| Background of active chip | `--color-secondary-light` *(soft saffron)* |
| Background of inactive | `transparent` with `1px solid --border-default` |
| Pause on hover | Yes (desktop only) |
| Reduced motion | Skip slide; cross-fade chips in place at 1.0× speed |

### Component spec

```tsx
<SWordsMarquee
  words={['Scan', 'Store', 'Search', 'Sign', 'Secure', 'Share', 'Speak', 'Simplify']}
  visibleCount={4}        // 4 on desktop, 2 on mobile
  intervalMs={1800}
  data-agent-id="landing.hero.s-words"
  data-agent-state="idle"
/>
```

### Accessibility

- Wrapping element gets `role="marquee"` with `aria-label="Eight things Kagaz does: Scan, Store, Search, Sign, Secure, Share, Speak, Simplify"`.
- The animation is **decorative** — the full eight words are also rendered in a visually-hidden static list for screen readers.
- Pauses if the user focuses inside the marquee with keyboard, resumes on blur.
- Honors `prefers-reduced-motion` (cross-fade instead of slide).

### Color cascade

The active chip cycles **only** its background, not its text. Avoids color-flashing — friendlier on low-end displays and in bright Indian sunlight.

---

## Section 3 — Trust strip

Below the hero, above the phone mockup if mobile. Four pills, horizontal scroll on mobile.

```
🔒 On-device AI    📴 Works offline    🇮🇳 Built for India    ✅ No account needed
```

| Pill | English copy | Hindi |
|---|---|---|
| 1 | `On-device AI` | `डिवाइस पर AI` |
| 2 | `Works offline` | `ऑफलाइन चलता है` |
| 3 | `Built for India` | `भारत के लिए बना` |
| 4 | `No account needed` | `अकाउंट की ज़रूरत नहीं` |

Each pill is a `<TrustPill>` molecule: small icon (16px) + label + soft border. No CTAs — it's reassurance, not navigation.

---

## Section 4 — "How it works" (three steps)

A 3-column layout (1 column on mobile) showing the three primary verbs.

| # | Verb | Hindi | Visual | Body |
|---|---|---|---|---|
| 1 | **Scan or upload** | `स्कैन या अपलोड` | Phone tilting toward an Aadhaar card | "Point your camera. Kagaz crops, deskews, and saves to your vault." |
| 2 | **Speak to Mitra** | `Mitra से बोलिए` | AI chat bubble with waveform | "Ask in Hindi or English: 'मेरा PAN दिखाओ', 'इन्हें merge करो', 'fill this form from my Aadhaar.'" |
| 3 | **Done.** | `बस।` | Green check + filled-form preview | "Merged. Compressed. Signed. Submitted. Your work is done." |

Each card has:
- A **3-second looping micro-animation** (Lottie or CSS), respecting reduced motion.
- An optional `Try it →` link (V2+ — deep-link into a sandboxed demo on web).

---

## Section 5 — Feature pillars

A 2×2 grid. Each pillar = one Kagaz module + one concrete user benefit.

| Pillar | Icon | Headline | Body |
|---|---|---|---|
| **Vault** | 🗄️ | "Your papers, encrypted on your phone." | "Aadhaar, PAN, marksheet, passport — sorted, searchable, never leaves your device." |
| **AI Mitra** | 🤖 | "An assistant that speaks your language." | "Voice or text, Hindi or English. Merges, signs, fills forms — all on-device. No cloud, no listening." |
| **Share** *(V2)* | 🔗 | "Share with a 5-digit code, expires when you want." | "Send your marksheet to your university. Link dies in 24 hours. You stay in control." |
| **Services** *(V3)* | 🏛️ | "Government services without the queue." | "Apply for PAN, update Aadhaar, book Aayushman card — from your couch, with Mitra guiding you." |

---

## Section 6 — Privacy section

A single full-width block. **The most important section after the hero.**

```
Your papers stay on your phone.
Always.

We don't have your Aadhaar. We can't have it.
Kagaz runs entirely on your device — the AI, the
search, the encryption. There is no Kagaz server
that holds your documents.

When you share (V2), only you decide who, how long,
and what they can do.

[ Read the privacy promise ▸ ]
```

| Element | English | Hindi |
|---|---|---|
| Headline | `Your papers stay on your phone. Always.` | `आपके दस्तावेज़ आपके फ़ोन में रहते हैं। हमेशा।` |
| CTA | `Read the privacy promise ▸` | `गोपनीयता का वादा पढ़ें ▸` |

Visual: an illustration of a phone with a soft lock icon and a glowing perimeter — not a server icon, not a cloud icon.

---

## Section 7 — Language strip

A simple horizontal strip showing the 6 launch languages with native names.

```
English  ·  हिन्दी  ·  தமிழ்  ·  తెలుగు  ·  বাংলা  ·  मराठी
```

Tagline below: *"Switch anytime. Mitra speaks your language too."* / *"कभी भी बदलें। Mitra भी आपकी भाषा बोलता है।"*

---

## Section 8 — Final CTA

Full-bleed band with the slogan repeated, the S-words static (no animation), and a single big button.

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              Sab kagaj. Ek Jagah.                  │
│                                                    │
│   Scan · Store · Search · Sign · Secure ·          │
│   Share · Speak · Simplify                         │
│                                                    │
│        [ Get Kagaz — it's free ]                   │
│                                                    │
│      Available on Android · iOS coming soon        │
└────────────────────────────────────────────────────┘
```

---

## Section 9 — Footer

Compact. Three columns on desktop, stacked on mobile.

| Column | Content |
|---|---|
| **Kagaz** | About · How it works · Privacy · Security · Open Source |
| **For users** | Help · Languages · Accessibility · Contact |
| **Omni Docs** | The company · Careers · Press · Blog |

Bottom row: `© 2026 Omni Docs Pvt Ltd. Made in India. 🇮🇳`

---

## Tokens used

| Token | Where |
|---|---|
| `--color-primary` (#1E3A5F) | Body text, marquee chip text, primary CTA bg |
| `--color-secondary` (#F59E0B) | "Ek Jagah" highlight, active marquee chip, accent underlines |
| `--color-accent` (#10B981) | Final "Done." green check |
| `--surface-1` | Page bg |
| `--surface-2` | Pillar cards bg |
| `--shadow-md` | Phone mockup elevation only |
| `--ease-emphasized` | All hero animations |
| `--duration-fast` (200ms) | Hover transitions |

No new tokens needed. The landing page composes the existing system.

---

## Agent annotations

Even the landing page is agent-operable — a remote agent should be able to drive a user through to install.

```tsx
<Hero data-agent-id="landing.hero">
  <Headline data-agent-id="landing.hero.headline" />
  <SWordsMarquee data-agent-id="landing.hero.s-words" data-agent-state="idle" />
  <Button
    data-agent-id="landing.hero.primary-cta"
    data-agent-action="landing.installApp"
    data-agent-role="primary-action"
    data-agent-state="idle"
  >
    Get Kagaz — it's free
  </Button>
  <Button
    data-agent-id="landing.hero.secondary-cta"
    data-agent-action="landing.scrollTo"
    data-agent-state="idle"
  >
    See how it works
  </Button>
</Hero>
```

Registered actions for the landing page (in `apps/marketing/src/landing.actions.ts`):

| Action id | Args | Behavior |
|---|---|---|
| `landing.installApp` | `{ platform?: 'android' \| 'ios' \| 'web' }` | Detects UA, redirects to the right store |
| `landing.scrollTo` | `{ section: 'how' \| 'pillars' \| 'privacy' \| 'languages' \| 'cta' }` | Smooth scroll |
| `landing.toggleLanguage` | `{ lang: 'en' \| 'hi' \| 'ta' \| 'te' \| 'bn' \| 'mr' }` | Reloads with `?lang=` |
| `landing.openPrivacy` | — | Navigates to `/privacy` |

Page skill at `apps/marketing/src/landing.skill.md` summarizes the page for agents that arrive via referral.

---

## Accessibility checklist

| # | Check | Verified by |
|---|---|---|
| 1 | Headline reaches contrast 7:1 on `--surface-1` | jest-axe |
| 2 | Marquee pauses on focus and respects `prefers-reduced-motion` | manual |
| 3 | Every CTA is a real `<button>` or `<a>`, ≥ 48dp tall | lint |
| 4 | Static, screen-reader-only list of the 8 S-words after the marquee | manual |
| 5 | Skip-to-content link at top | template |
| 6 | Heading hierarchy: `h1` (slogan) → `h2` (sections) → no skips | lint |
| 7 | Tested at 200% zoom on 360×640 viewport | manual |
| 8 | Hindi text uses `lang="hi"` so screen readers switch voices | template |

---

## Performance budget

| Metric | Target | Notes |
|---|---|---|
| Largest Contentful Paint | < 1.8 s on 4G | Hero headline must be in critical CSS |
| Total JS shipped | < 60 KB gzipped | No React on the landing — preact or astro |
| Total fonts shipped | < 100 KB | Subset Inter (latin + latin-ext) and Noto Devanagari only |
| Lottie animations | Defer until in-viewport | Use `loading="lazy"` equivalent |
| Phone mockup image | AVIF + WebP fallback, < 80 KB | Critical for LCP |

Recommended stack: **Astro** (static-first) + a single islands-of-interactivity component for the S-words marquee and the language switcher. Whole landing is ~80 KB on the wire.

---

## What we did NOT include (and why)

| Idea | Why not |
|---|---|
| Customer logo strip | We don't have customers yet. Faking it kills trust. |
| Pricing card | Kagaz V1 is free. No card needed. |
| "Trusted by X downloads" counter | Will be added once we cross 100K. Until then, vanity metric. |
| Video background | Murders LCP and battery, doesn't render reliably across UC Browser / MIUI browsers. |
| Chatbot popup | Aggressive. Mitra lives inside the app. The landing page sells the app, not the chat. |

---

## Build sequence (for engineering)

1. Astro page scaffold at `apps/marketing/src/pages/index.astro`.
2. `<Hero>` island with slogan + marquee + CTAs.
3. `<SWordsMarquee>` Preact component (the only stateful island).
4. Static sections 3–7 in plain HTML/MDX (no JS).
5. `<LanguageSwitcher>` island.
6. Wire actions in `landing.actions.ts`.
7. Lighthouse pass (target: Perf 95, A11y 100, SEO 100).
8. Lint pass: `pnpm agent:lint apps/marketing`.

---

*Last updated: 2026-06-08 · Kagaz by Omni Docs · Landing Page Spec v1.0*
