#!/usr/bin/env node
/**
 * Generates the Kagazzz logo concepts as SVG + a preview page.
 *
 *   node scripts/brand/build-logo-concepts.mjs
 *   open docs/brand/logo-concepts/index.html
 *
 * Every concept is one function `(p) => svgMarkup` drawn on a 100×100 grid, rendered in
 * three palettes (on the brand gradient, on light, on dark). Colors are the brand tokens
 * from docs/design-system/design-tokens.md (brand gradient + accent green). Output per
 * concept: `<id>-icon.svg` (1024 px app-icon tile), `<id>-mark.svg` (mark only, light
 * background), `<id>-lockup.svg` (icon + wordmark). Review-only: nothing here ships.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/brand/logo-concepts');

/** Brand tokens (design-tokens.md). */
const BRAND = { start: '#4F46E5', mid: '#7C3AED', end: '#A21CAF', ink: '#1E1B4B', accent: '#10B981' };

/**
 * Palettes a mark is drawn in. `main` = the dominant shape, `fold` = the shaded side of a
 * fold, `soft` = secondary shapes, `accent` = the green "safe / verified" touch,
 * `cut` = color punched through the main shape (letters, keyholes).
 */
const PALETTES = {
  gradient: { main: '#FFFFFF', fold: '#EDE9FE', soft: '#C4B5FD', accent: '#6EE7B7', cut: BRAND.start },
  light: { main: BRAND.start, fold: BRAND.mid, soft: '#A78BFA', accent: BRAND.accent, cut: '#FFFFFF' },
  dark: { main: '#FFFFFF', fold: '#DDD6FE', soft: '#A78BFA', accent: '#34D399', cut: '#0F172A' },
};

const DEVANAGARI = "'Noto Sans Devanagari','Kohinoor Devanagari','Mangal',sans-serif";

/** The concepts. `draw(p)` returns SVG children on a 0–100 grid; `small(p)` is the simplified ≤40 px form. */
const CONCEPTS = [
  {
    id: 'kashti',
    name: 'Kashti — the paper boat',
    tagline: '“Kaagaz ki kashti”',
    meaning:
      'Every Indian child has folded a paper boat. A boat made of paper that safely carries what matters across the water, like your documents carried safely on your phone.',
    notes: 'Strongest cultural story and instantly recognisable. The folds say "paper"; the green wave is the accent. Reduces to two shapes at 24 px.',
    draw: (p) => `
      <polygon points="18,58 30,40 40,58" fill="${p.soft}"/>
      <polygon points="60,58 70,40 82,58" fill="${p.soft}"/>
      <polygon points="36,58 50,20 64,58" fill="${p.main}"/>
      <polygon points="50,20 64,58 50,58" fill="${p.fold}"/>
      <polygon points="12,58 50,58 50,78 24,78" fill="${p.main}"/>
      <polygon points="50,58 88,58 76,78 50,78" fill="${p.fold}"/>
      <path d="M16 88 q8.5 -5 17 0 t17 0 t17 0 t17 0" fill="none" stroke="${p.accent}" stroke-width="4.5" stroke-linecap="round"/>`,
    small: (p) => `
      <polygon points="36,60 50,18 64,60" fill="${p.main}"/>
      <polygon points="10,60 90,60 77,82 23,82" fill="${p.main}"/>`,
  },
  {
    id: 'ka',
    name: 'क — the first letter of कागज़',
    tagline: 'Paper + India in one glance',
    meaning:
      'A sheet with a dog-eared corner carrying the Devanagari क. It reads as "paper" and "India" at once, for Hindi and English users alike.',
    notes: 'Closest to the current icon, so the switch is gentle. Outline the letter as a vector path before production (live text depends on installed fonts).',
    draw: (p) => `
      <path d="M26 12 H62 L78 28 V88 H26 Z" fill="${p.main}"/>
      <path d="M62 12 V28 H78 Z" fill="${p.soft}"/>
      <text x="52" y="70" text-anchor="middle" font-family="${DEVANAGARI}" font-weight="700" font-size="44" fill="${p.cut}">क</text>
      <rect x="38" y="77" width="28" height="4" rx="2" fill="${p.accent}"/>`,
    small: (p) => `
      <path d="M24 10 H64 L80 26 V90 H24 Z" fill="${p.main}"/>
      <text x="52" y="76" text-anchor="middle" font-family="${DEVANAGARI}" font-weight="700" font-size="56" fill="${p.cut}">क</text>`,
  },
  {
    id: 'fold-k',
    name: 'Folded K',
    tagline: 'A monogram folded from paper strips',
    meaning:
      'The K of Kagazzz built from three paper strips. One strip folds over another, and the shading shows the crease. Simple, geometric and ownable.',
    notes: 'Works best as a pure monogram for the app icon, the splash and the notification icon. Least literal, so it needs the wordmark nearby at first.',
    draw: (p) => `
      <path d="M26 16 H42 V84 H26 Z" fill="${p.main}"/>
      <path d="M42 16 L34 24 H42 Z" fill="${p.soft}"/>
      <polygon points="46,54 58,46 80,84 62,84" fill="${p.soft}"/>
      <polygon points="42,50 66,16 84,16 54,58" fill="${p.main}"/>
      <polygon points="42,50 54,58 46,62" fill="${p.fold}"/>`,
    small: (p) => `
      <path d="M24 14 H42 V86 H24 Z" fill="${p.main}"/>
      <polygon points="42,50 66,14 86,14 56,58" fill="${p.main}"/>
      <polygon points="48,56 60,48 84,86 64,86" fill="${p.main}"/>`,
  },
  {
    id: 'mohar',
    name: 'Mohar — the verified seal',
    tagline: 'Official, stamped, safe',
    meaning:
      'A document carrying a round मोहर (stamp) with a tick. Indian paperwork lives and dies by the seal; here the seal means verified and protected.',
    notes: 'Most "government documents" in feel and builds trust quickly. Watch that it does not look like an official government emblem; keep the seal generic, with no Ashoka or state symbols.',
    draw: (p) => `
      <path d="M22 12 H60 L72 24 V88 H22 Z" fill="${p.main}"/>
      <path d="M60 12 V24 H72 Z" fill="${p.soft}"/>
      <rect x="31" y="30" width="26" height="5" rx="2.5" fill="${p.soft}"/>
      <rect x="31" y="41" width="32" height="5" rx="2.5" fill="${p.soft}"/>
      <rect x="31" y="52" width="18" height="5" rx="2.5" fill="${p.soft}"/>
      <circle cx="66" cy="70" r="19" fill="none" stroke="${p.accent}" stroke-width="2.5" stroke-dasharray="3 3.2"/>
      <circle cx="66" cy="70" r="14.5" fill="${p.accent}"/>
      <path d="M59 70.5 l5 5 l9 -10" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    small: (p) => `
      <path d="M20 10 H62 L74 22 V90 H20 Z" fill="${p.main}"/>
      <circle cx="66" cy="70" r="20" fill="${p.accent}"/>
      <path d="M57 70.5 l6.5 6.5 l11 -12" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'shield',
    name: 'Paper shield',
    tagline: 'Privacy-first, literally',
    meaning:
      'A shield whose corner folds like a sheet of paper, with a keyhole in the middle. Your documents, locked, on your phone, with nothing leaving it.',
    notes: 'Says "privacy and security" fastest, the core promise of the app. Shields are common in security apps, so the paper fold is what makes it ours.',
    draw: (p) => `
      <path d="M50 10 L80 21 V48 C80 68 67 81 50 90 C33 81 20 68 20 48 V21 Z" fill="${p.main}"/>
      <path d="M66 15.9 L80 21 V35 Z" fill="${p.soft}"/>
      <path d="M66 15.9 L80 35 L70 33 Z" fill="${p.fold}"/>
      <circle cx="50" cy="45" r="8" fill="${p.cut}"/>
      <path d="M45.5 50 H54.5 L57 68 H43 Z" fill="${p.cut}"/>
      <rect x="40" y="76" width="20" height="3.5" rx="1.75" fill="${p.accent}"/>`,
    small: (p) => `
      <path d="M50 8 L82 20 V48 C82 69 68 82 50 92 C32 82 18 69 18 48 V20 Z" fill="${p.main}"/>
      <circle cx="50" cy="44" r="10" fill="${p.cut}"/>
      <path d="M44 50 H56 L59 72 H41 Z" fill="${p.cut}"/>`,
  },
  {
    id: 'zzz',
    name: 'Zzz stack',
    tagline: 'Sleep easy: your papers are sorted',
    meaning:
      'Three stacked sheets, like the zzz in Kagazzz, with a bold Z on top. It makes the name memorable and promises calm: your documents are in order, so you can relax.',
    notes: 'The most playful and the most memorable for the "Kagazzz" spelling. Less serious than Mohar or Shield, which suits a friendly consumer app.',
    draw: (p) => `
      <rect x="16" y="34" width="44" height="54" rx="7" fill="${p.soft}" transform="rotate(-10 38 61)"/>
      <rect x="26" y="24" width="44" height="54" rx="7" fill="${p.fold}" transform="rotate(-4 48 51)"/>
      <path d="M38 14 H74 L84 24 V72 Q84 76 80 76 H42 Q38 76 38 72 Z" fill="${p.main}"/>
      <path d="M74 14 V24 H84 Z" fill="${p.soft}"/>
      <path d="M50 32 H72 L50 58 H72" fill="none" stroke="${p.cut}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="80" cy="84" r="5" fill="${p.accent}"/>`,
    small: (p) => `
      <rect x="18" y="30" width="48" height="58" rx="8" fill="${p.soft}" transform="rotate(-10 42 59)"/>
      <rect x="34" y="12" width="52" height="66" rx="8" fill="${p.main}"/>
      <path d="M48 30 H72 L48 60 H72" fill="none" stroke="${p.cut}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
];

const gradientDef = (id) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND.start}"/><stop offset="0.55" stop-color="${BRAND.mid}"/><stop offset="1" stop-color="${BRAND.end}"/></linearGradient>`;

/** A rounded app-icon tile: gradient background + the mark at 72% (Android adaptive-icon safe zone). */
function iconSvg(c, size = 1024) {
  const g = `g-${c.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" role="img" aria-label="Kagazzz app icon — ${c.name}">
  <defs>${gradientDef(g)}</defs>
  <rect width="100" height="100" rx="23" fill="url(#${g})"/>
  <g transform="translate(14 14) scale(0.72)">${c.draw(PALETTES.gradient)}</g>
</svg>
`;
}

function markSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" role="img" aria-label="Kagazzz mark — ${c.name}">
${c.draw(PALETTES.light)}
</svg>
`;
}

function lockupSvg(c) {
  const g = `gl-${c.id}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="320" viewBox="0 0 375 100" role="img" aria-label="Kagazzz logo — ${c.name}">
  <defs>${gradientDef(g)}</defs>
  <rect x="4" y="10" width="80" height="80" rx="18" fill="url(#${g})"/>
  <g transform="translate(15.2 21.2) scale(0.576)">${c.draw(PALETTES.gradient)}</g>
  <text x="104" y="60" font-family="'Space Grotesk','Inter','Segoe UI',system-ui,sans-serif" font-weight="700" font-size="44" letter-spacing="-1" fill="${BRAND.ink}">Kagazzz</text>
  <text x="106" y="84" font-family="${DEVANAGARI}" font-weight="500" font-size="15" fill="#4B5563">कागज़ · आपके दस्तावेज़, आपके फ़ोन पर</text>
</svg>
`;
}

/** Inline tile for the preview page (each with its own gradient id). */
function tile(c, px, radius, bg, palette, simple, key) {
  const id = `t-${c.id}-${key}`;
  const fill = bg === 'gradient' ? `url(#${id})` : bg;
  const body = simple ? c.small(palette) : c.draw(palette);
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100" aria-hidden="true">${bg === 'gradient' ? `<defs>${gradientDef(id)}</defs>` : ''}<rect width="100" height="100" rx="${radius}" fill="${fill}" ${bg === '#FFFFFF' ? 'stroke="#E5E7EB" stroke-width="1"' : ''}/><g transform="translate(14 14) scale(0.72)">${body}</g></svg>`;
}

function card(c, i) {
  return `<article class="card">
    <header><span class="num">${i + 1}</span><div><h2>${c.name}</h2><p class="tag">${c.tagline}</p></div></header>
    <div class="row">
      ${tile(c, 200, 23, 'gradient', PALETTES.gradient, false, 'hero')}
      <div class="col">
        <div class="row">
          ${tile(c, 92, 23, '#FFFFFF', PALETTES.light, false, 'light')}
          ${tile(c, 92, 23, '#0F172A', PALETTES.dark, false, 'dark')}
        </div>
        <div class="row end">
          ${tile(c, 64, 23, 'gradient', PALETTES.gradient, false, 's64')}
          ${tile(c, 40, 23, 'gradient', PALETTES.gradient, true, 's40')}
          ${tile(c, 24, 23, 'gradient', PALETTES.gradient, true, 's24')}
          <span class="dim">64 · 40 · 24 px</span>
        </div>
      </div>
    </div>
    <div class="lockup">${lockupSvg(c).replace(/width="1200" height="320"/, 'width="100%" height="auto"')}</div>
    <div class="phone">
      <div class="home">${['#F59E0B', '#0EA5E9', 'self', '#22C55E'].map((x, k) => (x === 'self' ? tile(c, 52, 23, 'gradient', PALETTES.gradient, false, `home${k}`) : `<span class="app" style="background:${x}"></span>`)).join('')}</div>
      <span class="dim">On a home screen next to other apps</span>
    </div>
    <p>${c.meaning}</p>
    <p class="note">${c.notes}</p>
    <p class="files">Files: <a href="${c.id}-icon.svg">${c.id}-icon.svg</a> · <a href="${c.id}-mark.svg">${c.id}-mark.svg</a> · <a href="${c.id}-lockup.svg">${c.id}-lockup.svg</a></p>
  </article>`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kagazzz Logo Concepts</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Noto+Sans+Devanagari:wght@500;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#F8F7FF; --card:#FFFFFF; --ink:#1E1B4B; --muted:#4B5563; --line:#E5E7EB; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0B1020; --card:#111827; --ink:#F8FAFC; --muted:#CBD5E1; --line:#1F2937; } }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter,system-ui,sans-serif; }
  main { max-width:1320px; margin:0 auto; padding:40px 16px 80px; }
  h1 { font-family:'Space Grotesk',sans-serif; font-size:40px; margin:0 0 8px; letter-spacing:-0.02em; }
  .lead { color:var(--muted); max-width:820px; line-height:1.6; margin:0 0 28px; }
  .principles { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; margin:0 0 36px; padding:0; list-style:none; }
  .principles li { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:14px 16px; font-size:14px; line-height:1.5; color:var(--muted); }
  .principles b { color:var(--ink); display:block; margin-bottom:2px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:24px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:24px; padding:24px; display:flex; flex-direction:column; gap:18px; }
  .card header { display:flex; gap:12px; align-items:center; }
  .num { width:32px; height:32px; border-radius:50%; background:#EDE9FE; color:#4F46E5; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  h2 { font-family:'Space Grotesk',sans-serif; font-size:21px; margin:0; }
  .tag { margin:2px 0 0; color:var(--muted); font-size:14px; }
  .row { display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap; }
  .row.end { align-items:flex-end; }
  .col { display:flex; flex-direction:column; gap:14px; }
  .dim { font-size:12px; color:var(--muted); }
  .lockup { background:#FFFFFF; border:1px solid #E5E7EB; border-radius:16px; padding:12px 16px; }
  .lockup svg { display:block; width:100%; height:auto; }
  .phone { display:flex; flex-direction:column; gap:8px; }
  .home { display:flex; gap:14px; padding:14px; border-radius:18px; background:linear-gradient(160deg,#1E293B,#334155); width:max-content; }
  .app { width:52px; height:52px; border-radius:12px; display:block; opacity:.85; }
  .card p { margin:0; line-height:1.55; font-size:15px; }
  .card .note { font-size:13px; color:var(--muted); }
  .files { font-size:12px; color:var(--muted); }
  a { color:#7C3AED; }
  @media (max-width:480px) { .grid { grid-template-columns:1fr; } h1 { font-size:30px; } }
</style>
</head>
<body>
<main>
  <h1>Kagazzz — logo concepts</h1>
  <p class="lead">Six directions, each drawn as code (<code>scripts/brand/build-logo-concepts.mjs</code>) in the brand gradient (indigo → violet → fuchsia) with the green "safe" accent. Each one is shown as the app icon, on light and dark, at small sizes, as a wordmark lockup, and on a home screen. Pick one or two to refine.</p>
  <ul class="principles">
    <li><b>One idea</b>Great product marks say one thing (Dropbox: an open box; Google Drive: the drive triangle). Each concept here carries one story.</li>
    <li><b>Works at 24 px</b>App icons live as small tiles, so every concept has a simplified small form, shown at 40 and 24 px.</li>
    <li><b>Ownable meaning</b>Generic "document + check" icons all look alike. Kagazzz has unique hooks: कागज़, the paper boat, the zzz.</li>
    <li><b>Fits the brand</b>Uses the existing gradient tokens and the green accent, so the app UI does not change.</li>
    <li><b>Trust for ID documents</b>The app holds Aadhaar and PAN, so the mark must feel safe and calm, not playful only.</li>
    <li><b>No official symbols</b>No Ashoka emblem or national flag. Using them on a private app is restricted, and it would mislead users.</li>
  </ul>
  <div class="grid">
${CONCEPTS.map(card).join('\n')}
  </div>
</main>
</body>
</html>
`;
}

mkdirSync(OUT, { recursive: true });
for (const c of CONCEPTS) {
  writeFileSync(path.join(OUT, `${c.id}-icon.svg`), iconSvg(c));
  writeFileSync(path.join(OUT, `${c.id}-mark.svg`), markSvg(c));
  writeFileSync(path.join(OUT, `${c.id}-lockup.svg`), lockupSvg(c));
}
writeFileSync(path.join(OUT, 'index.html'), indexHtml());
console.log(`[logo-concepts] ${CONCEPTS.length} concepts → ${path.relative(process.cwd(), OUT)}/index.html`);
