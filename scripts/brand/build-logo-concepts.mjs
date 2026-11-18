#!/usr/bin/env node
/**
 * Generates the Kagazzz logo concepts (round 2) as SVG + a preview page.
 *
 *   node scripts/brand/build-logo-concepts.mjs
 *   open docs/brand/logo-concepts/index.html
 *
 * Round 2 follows how the best-known app marks work (GitHub, Claude, Spotify, WhatsApp,
 * Instagram): ONE bold silhouette, ONE owned color, at most one accent, no text in the
 * icon, crisp edges, and it must still read as a black silhouette at 24 px. Each concept
 * therefore has its own color story instead of sharing one gradient.
 *
 * Each mark is `draw({ fg, cut, accent })` on a 100×100 grid: `fg` = the symbol, `cut` =
 * negative space punched through it (normally the tile color), `accent` = the one optional
 * highlight. Output per concept: `<id>-icon.svg` (1024 px tile), `<id>-mark.svg`,
 * `<id>-mono.svg` (single color, for tinted/monochrome icons), `<id>-lockup.svg`.
 * Review-only: nothing here ships until a concept is chosen.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/brand/logo-concepts');
const SANS = "'Space Grotesk','Inter','Segoe UI',system-ui,sans-serif";

/**
 * The concepts. `tile` is the icon background (a color or a {from,to} gradient); `fg` the
 * symbol color on it; `cutOnTile` the negative-space color on the tile; `ink` the brand
 * color used when the mark sits on white; `accent` its one highlight.
 */
/**
 * Shared pieces of the round-4 marks.
 * kTick: the paper K whose arms are a tick (✓): a stem with a dog-eared corner, then a short
 * stroke down and a long stroke up. z3: "z³" (z cubed = zzz) for the top-right corner.
 */
const kTick = ({ fg, accent }) => `
      <path d="M12 16 H25 L33 24 V88 H12 Z" fill="${fg}"/>
      <path d="M25 16 L33 24 H25 Z" fill="${accent}"/>
      <path d="M33 54 L49 72 L79 22" fill="none" stroke="${fg}" stroke-width="13" stroke-linejoin="miter" stroke-miterlimit="10"/>`;
const z3 = ({ fg }, x = 82, y = 1) => `
      <path d="M${x} ${y + 2} H${x + 12} L${x} ${y + 16} H${x + 12}" fill="none" stroke="${fg}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="${x + 14.5}" y="${y + 7}" font-family="${SANS}" font-weight="700" font-size="9.5" fill="${fg}">3</text>`;

const CONCEPTS = [
  {
    id: 'tick-k-z3',
    name: 'Tick-K z³',
    color: 'Saffron · featured',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'The paper K whose arms are a tick (✓), with z³ in the top corner. z cubed = zzz, so the mark spells Kagazzz: K·a·g·a·z + z³.',
    why: 'K for Kagazzz, the tick for "verified, safe, done", the dog-ear for paper, and z³ as the clever detail people notice second. At 24 px it still reads as K plus a tick.',
    draw: (p) => `${kTick(p)}${z3(p)}`,
  },
  {
    id: 'tick-k-seal',
    name: 'Tick-K z³ in a seal',
    color: 'Saffron · Mohar mix',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'The tick-K stamped inside a round मोहर (seal), with z³ in the corner: an official, verified document stamp that spells Kagazzz.',
    why: 'Mixes card 1 with the Mohar seal: the strongest "official document" feel. The seal ring gives the icon a distinctive round silhouette among square app icons.',
    draw: (p) => `
      <circle cx="47" cy="53" r="38" fill="none" stroke="${p.fg}" stroke-width="3.5" stroke-dasharray="5 3.6"/>
      <circle cx="47" cy="53" r="31" fill="${p.fg}"/>
      <g transform="translate(22 28) scale(0.5)">${kTick({ fg: p.cut, accent: p.accent })}</g>${z3(p, 78, 2)}`,
  },
  {
    id: 'tick-k-shield',
    name: 'Tick-K z³ on a shield',
    color: 'Saffron · Vault mix',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'The tick-K cut out of a shield, with z³ in the corner: your documents, verified and protected.',
    why: 'Mixes card 1 with the Vault shield: says "privacy and security" first and "K" second. Reads as a security app, which suits an Aadhaar/PAN vault.',
    draw: (p) => `
      <path d="M46 8 L80 20 V48 C80 70 65 83 46 92 C27 83 12 70 12 48 V20 Z" fill="${p.fg}"/>
      <g transform="translate(23 26) scale(0.5)">${kTick({ fg: p.cut, accent: p.accent })}</g>${z3(p, 84, 0)}`,
  },
  {
    id: 'paper-kz',
    name: 'Paper Kz',
    color: 'Saffron · featured',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'The folded paper K (see the Folded K card below), now in saffron, with a small z as a subscript: Kz, the K and the zzz of Kagazzz Docs.',
    why: 'Keeps the folded-paper K you liked (the dog-ear on the stem says "paper"), adds the z so the mark belongs to Kagazzz and no other K brand. Two shapes plus a tiny accent: it holds up at 24 px.',
    draw: ({ fg, accent }) => `
      <path d="M10 14 H23 L31 22 V86 H10 Z" fill="${fg}"/>
      <path d="M23 14 L31 22 H23 Z" fill="${accent}"/>
      <path d="M35 51 L55 14 H73 L47 59 Z" fill="${fg}"/>
      <path d="M43 59 L51 53 L71 86 H53 Z" fill="${fg}"/>
      <path d="M76 66 H89 L76 85 H89" fill="none" stroke="${fg}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'paper-kz-mouth',
    name: 'Paper Kz (z inside)',
    color: 'Saffron · variant',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'Same paper K, with the small z tucked into the open side of the K, as if the K is holding it.',
    why: 'More compact and more square than the subscript version, so the K can be drawn bigger. The z is smaller, though, so it fades sooner at tiny sizes.',
    draw: ({ fg, accent }) => `
      <path d="M16 12 H30 L38 20 V88 H16 Z" fill="${fg}"/>
      <path d="M30 12 L38 20 H30 Z" fill="${accent}"/>
      <path d="M42 49 L64 12 H84 L54 58 Z" fill="${fg}"/>
      <path d="M50 58 L59 52 L84 88 H64 Z" fill="${fg}"/>
      <path d="M70 46 H82 L70 60 H82" fill="none" stroke="${fg}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'safe-page',
    name: 'Safe Page',
    color: 'Saffron',
    tile: '#F25C05',
    fg: '#FFFFFF',
    cutOnTile: '#F25C05',
    ink: '#E4570A',
    accent: '#FFC9A8',
    wordBg: '#FFF7F0',
    story: 'A document with a folded corner and a bold tick cut through it: your document, saved and safe.',
    why: 'Instantly reads as "document" and "done". Saffron makes it warm, Indian and unlike the blue or green of most document apps; the white page and the tick cut out of it are the whole mark.',
    draw: ({ fg, cut, accent }) => `
      <path d="M20 10 H60 L82 32 V90 H20 Z" fill="${fg}"/>
      <path d="M60 10 V32 H82 Z" fill="${accent}"/>
      <path d="M34 59 L46 71 L68 46" fill="none" stroke="${cut}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'fold-k',
    name: 'Folded K',
    color: 'Graphite',
    tile: '#0D1117',
    fg: '#FFFFFF',
    cutOnTile: '#0D1117',
    ink: '#0D1117',
    accent: '#7EE787',
    wordBg: '#F6F8FA',
    story: 'The K of Kagazzz, folded from paper. The top-right corner of the stem is a dog-ear.',
    why: 'GitHub-style restraint: white on near-black, one tiny accent. Reads like serious developer-grade software, and works in any single color.',
    draw: ({ fg, cut, accent }) => `
      <path d="M20 14 H33 L41 22 V86 H20 Z" fill="${fg}"/>
      <path d="M33 14 L41 22 H33 Z" fill="${accent}"/>
      <path d="M45 50 L67 14 H87 L58 58 Z" fill="${fg}"/>
      <path d="M53 58 L62 52 L87 86 H67 Z" fill="${fg}"/>
      <path d="M45 50 L58 58" stroke="${cut}" stroke-width="3"/>`,
  },
  {
    id: 'mohar',
    name: 'Mohar',
    color: 'Seal green on paper',
    tile: '#F4EEE1',
    fg: '#0F5B45',
    cutOnTile: '#F4EEE1',
    ink: '#0F5B45',
    accent: '#0F5B45',
    wordBg: '#F4EEE1',
    story: 'A round मोहर (rubber stamp) with a folded page inside: verified, official, kept safe.',
    why: 'Paper-colored tile plus deep ink green, like a stamped certificate. It looks trustworthy for ID documents and stands out on a home screen full of saturated colors. Generic seal only, with no state emblems.',
    draw: ({ fg, cut }) => `
      <circle cx="50" cy="50" r="42" fill="none" stroke="${fg}" stroke-width="4" stroke-dasharray="5.5 4"/>
      <circle cx="50" cy="50" r="34" fill="${fg}"/>
      <path d="M36 28 H57 L66 37 V72 H36 Z" fill="${cut}"/>
      <path d="M57 28 V37 H66 Z" fill="${fg}" opacity="0.35"/>
      <path d="M42 53 L48.5 59.5 L60 47" fill="none" stroke="${fg}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: 'corner',
    name: 'Corner',
    color: 'Cobalt on white',
    tile: '#FFFFFF',
    fg: '#1F4FFF',
    cutOnTile: '#FFFFFF',
    ink: '#1F4FFF',
    accent: '#9DB4FF',
    wordBg: '#FFFFFF',
    story: 'Just a sheet of paper with a big folded corner. The simplest possible way to say "kagaz".',
    why: 'Dropbox and Notion-style minimalism: a white tile with one cobalt shape and one lighter shade. Calm and premium, and it survives as a single color.',
    draw: ({ fg, accent }) => `
      <path d="M18 12 H58 L84 38 V88 H18 Z" fill="${fg}"/>
      <path d="M58 12 V38 H84 Z" fill="${accent}"/>`,
  },
  {
    id: 'vault',
    name: 'Vault',
    color: 'Midnight navy',
    tile: '#0A2540',
    fg: '#FFFFFF',
    cutOnTile: '#0A2540',
    ink: '#0A2540',
    accent: '#00D4B5',
    wordBg: '#F6F9FC',
    story: 'A shield whose corner folds like paper, with a keyhole: your documents, locked, on your phone.',
    why: 'Bank-grade navy with one teal accent, the way fintech apps signal trust. It says privacy, the app’s core promise, in a single shape.',
    draw: ({ fg, cut, accent }) => `
      <path d="M50 8 L84 20 V48 C84 70 69 83 50 92 C31 83 16 70 16 48 V20 Z" fill="${fg}"/>
      <path d="M68 13.6 L84 20 V36 Z" fill="${accent}"/>
      <circle cx="50" cy="44" r="9" fill="${cut}"/>
      <path d="M45 50 H55 L58 70 H42 Z" fill="${cut}"/>`,
  },
  {
    id: 'zzz',
    name: 'Zzz',
    color: 'Sunset gradient',
    tile: { from: '#FF8A3D', via: '#FF3D6E', to: '#9B3DFF' },
    fg: '#FFFFFF',
    cutOnTile: '#FF3D6E',
    ink: '#FF3D6E',
    accent: '#FFFFFF',
    wordBg: '#FFF5F7',
    story: 'A stack of sheets with a bold Z: the zzz in Kagazzz. Sleep easy, your papers are sorted.',
    why: 'Instagram-style energy: the only gradient concept, warm to violet, with a white glyph. The most playful and memorable for the name; best if the brand leans consumer and friendly.',
    draw: ({ fg, cut }) => `
      <rect x="12" y="30" width="50" height="58" rx="9" fill="${fg}" opacity="0.45" transform="rotate(-12 37 59)"/>
      <rect x="32" y="12" width="56" height="70" rx="10" fill="${fg}"/>
      <path d="M47 31 H73 L47 63 H73" fill="none" stroke="${cut}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
];

/** Neighbouring "apps" on the home-screen mock: plain colour tiles only (no third-party marks). */
const NEIGHBOURS = ['#25D366', '#FF0000', { from: '#FEDA75', via: '#D62976', to: '#4F5BD5' }, '#1DB954', '#FFFFFF', '#0866FF'];

let gid = 0;
/** Fill + optional <defs> for a tile background (solid or gradient). */
function paint(bg) {
  if (typeof bg === 'string') {
    return { defs: '', fill: bg };
  }
  const id = `g${gid++}`;
  return {
    defs: `<defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${bg.from}"/><stop offset="0.5" stop-color="${bg.via}"/><stop offset="1" stop-color="${bg.to}"/></linearGradient></defs>`,
    fill: `url(#${id})`,
  };
}

/** One rounded icon tile with the mark at ~70% (inside Android's adaptive-icon safe zone). */
function tileSvg(c, px, variant = 'primary') {
  const v = {
    primary: { bg: c.tile, fg: c.fg, cut: c.cutOnTile, accent: c.accent },
    light: { bg: '#FFFFFF', fg: c.ink, cut: '#FFFFFF', accent: c.accent === '#FFFFFF' ? c.ink : c.accent },
    dark: { bg: '#111111', fg: '#FFFFFF', cut: '#111111', accent: c.accent === '#FFFFFF' ? '#FFFFFF' : c.accent },
    silhouette: { bg: '#FFFFFF', fg: '#111111', cut: '#FFFFFF', accent: '#111111' },
  }[variant];
  const { defs, fill } = paint(v.bg);
  const border = v.bg === '#FFFFFF' || v.bg === '#F4EEE1' ? ' stroke="#D0D7DE" stroke-width="0.8"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100" role="img" aria-label="Kagazzz Docs ${c.name} icon (${variant})">${defs}<rect x="0.4" y="0.4" width="99.2" height="99.2" rx="22.5" fill="${fill}"${border}/><g transform="translate(15 15) scale(0.7)">${c.draw(v)}</g></svg>`;
}

function markSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" role="img" aria-label="Kagazzz Docs ${c.name} mark">${c.draw({ fg: c.ink, cut: '#FFFFFF', accent: c.accent === '#FFFFFF' ? c.ink : c.accent })}</svg>\n`;
}

function monoSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 100 100" role="img" aria-label="Kagazzz Docs ${c.name} mark, single colour">${c.draw({ fg: '#000000', cut: '#FFFFFF', accent: '#000000' })}</svg>\n`;
}

/** Icon + lowercase wordmark, on light or dark. */
function lockupSvg(c, dark = false) {
  const { defs, fill } = paint(c.tile);
  const text = dark ? '#FFFFFF' : '#111111';
  const bg = dark ? '#111111' : c.wordBg;
  const border = c.tile === '#FFFFFF' || c.tile === '#F4EEE1' ? ' stroke="#D0D7DE" stroke-width="0.8"' : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="300" viewBox="0 0 480 100" role="img" aria-label="Kagazzz Docs logo — ${c.name}">${defs}<rect width="480" height="100" rx="14" fill="${bg}"/><rect x="18" y="18" width="64" height="64" rx="14.5" fill="${fill}"${border}/><g transform="translate(27.6 27.6) scale(0.448)">${c.draw({ fg: c.fg, cut: c.cutOnTile, accent: c.accent })}</g><text x="100" y="64" font-family="${SANS}" font-weight="700" font-size="42" letter-spacing="-1.2" fill="${text}">Kagazzz<tspan font-weight="500" fill-opacity="0.6"> Docs</tspan></text></svg>\n`;
}

function homeScreen(c) {
  const apps = [...NEIGHBOURS.slice(0, 3), 'self', ...NEIGHBOURS.slice(3)];
  const cells = apps
    .map((a) => {
      if (a === 'self') {
        return `<div class="cell">${tileSvg(c, 52)}<span>Kagazzz Docs</span></div>`;
      }
      const { defs, fill } = paint(a);
      return `<div class="cell"><svg width="52" height="52" viewBox="0 0 100 100" aria-hidden="true">${defs}<rect width="100" height="100" rx="22.5" fill="${fill}"/></svg><span>&nbsp;</span></div>`;
    })
    .join('');
  return `<div class="home">${cells}</div>`;
}

function card(c, i) {
  const swatch = typeof c.tile === 'string' ? c.tile : `linear-gradient(45deg, ${c.tile.from}, ${c.tile.via}, ${c.tile.to})`;
  return `<article class="card">
  <header>
    <span class="num">${i + 1}</span>
    <div><h2>${c.name}</h2><p class="tag"><span class="sw" style="background:${swatch}"></span>${c.color}</p></div>
  </header>
  <div class="hero">${tileSvg(c, 180)}</div>
  <div class="variants">
    <figure>${tileSvg(c, 72, 'light')}<figcaption>On white</figcaption></figure>
    <figure>${tileSvg(c, 72, 'dark')}<figcaption>Dark mode</figcaption></figure>
    <figure>${tileSvg(c, 72, 'silhouette')}<figcaption>Silhouette test</figcaption></figure>
    <figure class="sizes">${tileSvg(c, 40)}${tileSvg(c, 24)}<figcaption>40 · 24 px</figcaption></figure>
  </div>
  <div class="lockups">${lockupSvg(c)}${lockupSvg(c, true)}</div>
  ${homeScreen(c)}
  <p class="story">${c.story}</p>
  <p class="why">${c.why}</p>
  <p class="files"><a href="${c.id}-icon.svg">icon</a> · <a href="${c.id}-mark.svg">mark</a> · <a href="${c.id}-mono.svg">mono</a> · <a href="${c.id}-lockup.svg">lockup</a></p>
</article>`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Kagazzz Docs Logo</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --bg:#FAFAF9; --card:#FFFFFF; --ink:#111111; --muted:#57534E; --line:#E7E5E4; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#0C0A09; --card:#1C1917; --ink:#FAFAF9; --muted:#D6D3D1; --line:#292524; } }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:Inter,system-ui,sans-serif; }
  main { max-width:1360px; margin:0 auto; padding:48px 16px 96px; }
  h1 { font-family:'Space Grotesk',sans-serif; font-size:44px; letter-spacing:-0.03em; margin:0 0 10px; }
  .lead { color:var(--muted); max-width:860px; line-height:1.6; margin:0 0 28px; font-size:16px; }
  .rules { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:10px; list-style:none; padding:0; margin:0 0 40px; }
  .rules li { border:1px solid var(--line); background:var(--card); border-radius:12px; padding:12px 14px; font-size:13.5px; line-height:1.5; color:var(--muted); }
  .rules b { color:var(--ink); display:block; font-size:14px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(400px,1fr)); gap:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:24px; padding:24px; display:flex; flex-direction:column; gap:18px; }
  header { display:flex; gap:12px; align-items:center; }
  .num { width:30px; height:30px; border-radius:50%; border:1.5px solid var(--ink); font-weight:600; font-size:14px; display:flex; align-items:center; justify-content:center; }
  h2 { font-family:'Space Grotesk',sans-serif; font-size:24px; margin:0; letter-spacing:-0.02em; }
  .tag { margin:2px 0 0; color:var(--muted); font-size:13px; display:flex; align-items:center; gap:6px; }
  .sw { width:12px; height:12px; border-radius:3px; display:inline-block; border:1px solid rgba(0,0,0,.15); }
  .hero { display:flex; justify-content:center; padding:24px 0; border-radius:18px; background:repeating-linear-gradient(45deg, transparent 0 10px, rgba(127,127,127,.06) 10px 20px); }
  .hero svg { filter:drop-shadow(0 10px 24px rgba(0,0,0,.18)); }
  .variants { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end; }
  figure { margin:0; display:flex; flex-direction:column; gap:6px; align-items:center; }
  .sizes { flex-direction:row; flex-wrap:wrap; align-items:flex-end; gap:8px; max-width:90px; justify-content:center; }
  .sizes figcaption { width:100%; text-align:center; }
  figcaption { font-size:11.5px; color:var(--muted); }
  .lockups { display:grid; gap:8px; }
  .lockups svg { width:100%; height:auto; display:block; border-radius:12px; border:1px solid var(--line); }
  .home { display:grid; grid-template-columns:repeat(4, 52px); gap:12px 18px; padding:16px; border-radius:18px; background:linear-gradient(160deg,#2B2F36,#14161A); justify-content:center; overflow-x:auto; }
  .cell { display:flex; flex-direction:column; align-items:center; gap:4px; }
  .cell span { font-size:10px; color:#E5E7EB; }
  .story { margin:0; font-size:15px; line-height:1.55; }
  .why { margin:0; font-size:13.5px; line-height:1.55; color:var(--muted); }
  .files { margin:0; font-size:12px; color:var(--muted); }
  a { color:inherit; }
  @media (max-width:480px) { .grid { grid-template-columns:1fr; } h1 { font-size:32px; } }
</style>
</head>
<body>
<main>
  <h1>Kagazzz Docs — logo, round 4</h1>
  <p class="lead"><b>New in round 4:</b> cards 1–3. The K's arms are now a tick (✓), with <b>z³</b> (z cubed = zzz) in the top corner, so the mark spells Kagazzz. Card 1 is the pure mark, card 2 mixes it with the Mohar seal, and card 3 with the Vault shield. Round-3 Paper Kz cards follow. The earlier directions follow for comparison, each with its <b>own colour</b>, built the way the best-known app marks are: GitHub (white on graphite), Claude (one warm colour), Spotify and WhatsApp (one owned colour), Instagram (one gradient, one glyph). Every concept is checked on white, in dark mode, as a black silhouette, at 24 px, as a wordmark and on a home screen.</p>
  <ul class="rules">
    <li><b>One silhouette</b>Recognisable from the outline alone; see each card's black "silhouette test".</li>
    <li><b>One owned colour</b>A dominant background, one symbol colour, at most one accent.</li>
    <li><b>No text in the icon</b>Text is unreadable at icon size; the name goes in the wordmark.</li>
    <li><b>Crisp edges</b>Flat shapes, no soft glows, so iOS and Android effects and tinted modes render cleanly.</li>
    <li><b>Works at 24 px</b>Notification icons, settings lists and share sheets are tiny.</li>
    <li><b>No official symbols</b>No national emblem or flag on a private app.</li>
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
for (const f of readdirSync(OUT)) {
  rmSync(path.join(OUT, f)); // regenerate cleanly: no stale files from older rounds
}
for (const c of CONCEPTS) {
  writeFileSync(path.join(OUT, `${c.id}-icon.svg`), `${tileSvg(c, 1024)}\n`);
  writeFileSync(path.join(OUT, `${c.id}-mark.svg`), markSvg(c));
  writeFileSync(path.join(OUT, `${c.id}-mono.svg`), monoSvg(c));
  writeFileSync(path.join(OUT, `${c.id}-lockup.svg`), lockupSvg(c));
}
writeFileSync(path.join(OUT, 'index.html'), indexHtml());
console.log(`[logo-concepts] ${CONCEPTS.length} concepts → ${path.relative(process.cwd(), OUT)}/index.html`);
