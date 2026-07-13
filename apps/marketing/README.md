# Kagaz landing page (G1-8)

The public marketing page — implemented from `docs/landing-page.md`. **Static,
zero-build, zero-dependency** vanilla HTML/CSS/JS (`index.html` + `styles.css` +
`app.js`), so it beats the spec's perf budget (< 60 KB JS, no framework) and
hosts anywhere.

## Preview locally

```bash
npx serve apps/marketing      # or: python3 -m http.server -d apps/marketing
```

## Deploy to Vercel

1. **New Project → Import** the repo.
2. **Root Directory** = `apps/marketing`, Framework preset = **Other** (no build
   command — it's already static; `vercel.json` sets clean URLs + security
   headers).
3. Deploy.

Host it on the **same domain** as the legal site (`apps/legal-site`) — or add a
Vercel rewrite — so the footer's `/privacy` and `/terms` links resolve.

## What's faithful vs. deferred (vs. `docs/landing-page.md`)

Implemented: all 9 sections, en/hi toggle (`?lang=`, `<html lang>` + per-run
`lang="hi"`), the **chip-cycling S-words marquee** (1.8 s cycle, pause on
hover/focus, `prefers-reduced-motion` cross-fade, SR static list), trust strip,
how-it-works, feature pillars (V2/V3 tagged), privacy block, language strip,
final CTA, footer; light + dark; design-system token values; `data-agent-id` +
`data-agent-action` on every CTA; skip link; 48 dp+ buttons; heading hierarchy.

Deferred (need real assets / product decisions):
- **Phone mockup** is an inline-SVG placeholder — swap for a real AVIF/WebP
  screenshot (< 80 KB) for LCP.
- **Section-4 Lottie micro-animations** — static cards for now.
- **Subset fonts** (Inter + Noto Devanagari) — currently system fonts; add
  subset webfonts if brand typography is required.
- Tamil/Telugu/Bangla/Marathi copy — only en/hi are wired (V1 languages);
  the language strip lists all six names.
- Store URL uses `in.kagaz.app`; confirm before launch.

Chose vanilla static over the spec's suggested Astro: leaner, no toolchain, and
it already meets the perf/JS budget. A11y + Lighthouse still need a served run
(G1-3 / G1-4 tails).
