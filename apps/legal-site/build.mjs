/**
 * Static legal-site generator (G1-5 external): renders the Privacy Policy and
 * Terms & Conditions Markdown into standalone HTML pages for public hosting
 * (Vercel / Cloudflare Pages / any static host). Zero dependencies.
 *
 * Source of truth is `docs/legal/*.md`. When this build runs from the repo it
 * re-syncs the bundled copies under `content/` first, so a Vercel project rooted
 * at `apps/legal-site` (which only sees `content/`) still ships current text.
 *
 * Usage:  node apps/legal-site/build.mjs   →   apps/legal-site/dist/*.html
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const siteDir = dirname(fileURLToPath(import.meta.url));
const repoLegal = join(siteDir, '..', '..', 'docs', 'legal');
const contentDir = join(siteDir, 'content');
const distDir = join(siteDir, 'dist');

const DOCS = [
  { slug: 'privacy', file: 'privacy-policy.md', title: 'Privacy Policy' },
  { slug: 'terms', file: 'terms-and-conditions.md', title: 'Terms & Conditions' },
];

/** Re-sync bundled copies from docs/legal when building inside the repo. */
for (const { file } of DOCS) {
  const src = join(repoLegal, file);
  if (existsSync(src)) {
    copyFileSync(src, join(contentDir, file));
  }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline **bold** and [text](url) (http/mailto only); everything else escaped. */
function inline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:[^)]+|mailto:[^)]+)\)/g, '<a href="$2">$1</a>');
}

/** Minimal Markdown → HTML (headings, paragraphs, lists, hr, inline). */
function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = [];
  const flush = () => {
    if (list.length) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</ul>`);
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flush();
    if (line === '') continue;
    if (/^---+$/.test(line)) {
      out.push('<hr>');
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(h[1].length, 3);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flush();
  return out.join('\n');
}

const STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    line-height: 1.6; max-width: 46rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
    color: #1a1a1a; background: #fff; }
  @media (prefers-color-scheme: dark) { body { color: #e6e6e6; background: #101114; } }
  h1 { font-size: 1.6rem; } h2 { font-size: 1.25rem; margin-top: 2rem; }
  h3 { font-size: 1.05rem; margin-top: 1.5rem; }
  a { color: #2563eb; } @media (prefers-color-scheme: dark){ a{ color:#7aa2ff; } }
  hr { border: none; border-top: 1px solid #8883; margin: 2rem 0; }
  nav { margin-bottom: 2rem; font-size: .95rem; }
  footer { margin-top: 3rem; font-size: .85rem; opacity: .7; }
`;

const page = (title, bodyHtml) => `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Kagaz</title>
<style>${STYLE}</style>
</head><body>
<nav><a href="./index.html">← Kagaz legal</a></nav>
${bodyHtml}
<footer>Kagaz (Omni Docs). This page is generated from the app's canonical legal documents.</footer>
</body></html>`;

mkdirSync(distDir, { recursive: true });

const placeholders = [];
const PLACEHOLDER_RE = /replace before launch|@omnidocs\.example|Pvt Ltd|TODO|placeholder/i;

for (const { slug, file, title } of DOCS) {
  const md = readFileSync(join(contentDir, file), 'utf8');
  md.split('\n').forEach((line, i) => {
    if (PLACEHOLDER_RE.test(line)) placeholders.push(`${file}:${i + 1}  ${line.trim()}`);
  });
  writeFileSync(join(distDir, `${slug}.html`), page(title, mdToHtml(md)));
}

writeFileSync(
  join(distDir, 'index.html'),
  page(
    'Legal',
    `<h1>Kagaz — Legal</h1><ul>
      <li><a href="./privacy.html">Privacy Policy</a></li>
      <li><a href="./terms.html">Terms &amp; Conditions</a></li>
    </ul>`
  )
);

console.log(`[legal-site] wrote ${DOCS.length + 1} pages to ${distDir}`);
if (placeholders.length) {
  console.warn(
    `\n[legal-site] ⚠️  ${placeholders.length} PLACEHOLDER(S) — replace before publishing:\n  ${placeholders.join('\n  ')}`
  );
}
