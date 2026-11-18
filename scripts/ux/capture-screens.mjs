#!/usr/bin/env node
/**
 * Screenshot every screen of the app (UX audit, docs/ux/screen-audit.md).
 *
 * Drives the browser web demo (dev server only, ADR-025) in a headless
 * Chrome over the DevTools Protocol at a phone viewport, seeds FAKE
 * documents, walks every route / sheet / menu, and writes one PNG per screen
 * plus a `<name>.ids.txt` listing the `data-agent-id`s visible on it.
 * Zero dependencies — Node's global fetch/WebSocket, like
 * scripts/device-e2e/cdp.mjs.
 *
 * Usage:
 *   pnpm --filter kagaz dev:web-demo -- --port 5199     # in another terminal
 *   node scripts/ux/capture-screens.mjs [--theme light|dark|both] [--lang en|hi] [--out dir]
 *
 * Env: KAGAZ_URL (http://localhost:5199), CHROME (path to a Chrome/Chromium).
 * Native-only screens (scanner, camera, biometric, on-device AI) can't run
 * in a browser; the AI screens render their "unsupported" state.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = process.env.KAGAZ_URL ?? 'http://localhost:5199';
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const THEMES = opt('theme', 'both') === 'both' ? ['light', 'dark'] : [opt('theme', 'light')];
const LANG = opt('lang', 'en');
const OUT = path.resolve(opt('out', 'docs/ux/screens'));
const PORT = 9333;
const VIEWPORT = { width: 412, height: 915 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const consoleLines = [];

// ── Browser + CDP ─────────────────────────────────────────────────────────
async function launch() {
  const profile = mkdtempSync(path.join(os.tmpdir(), 'kagaz-shots-'));
  const proc = spawn(
    CHROME,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return { proc, profile, wsUrl: page.webSocketDebuggerUrl };
    } catch {
      /* not up yet */
    }
    await sleep(200);
  }
  throw new Error('Chrome did not start (set CHROME=/path/to/chrome)');
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let next = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    // Page console warnings/errors and uncaught exceptions → console.log in the output dir.
    if (msg.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(msg.params.type)) {
      consoleLines.push(`[${msg.params.type}] ` + msg.params.args
        .map((a) => a.value ?? (a.preview ? a.preview.properties.map((p) => `${p.name}=${p.value}`).join(' ') : a.description) ?? '')
        .join(' ').slice(0, 400));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleLines.push('[exception] ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).slice(0, 400));
    }
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return new Promise((resolve) => ws.addEventListener('open', () => resolve({ ws, send })));
}

// ── Page helpers (all address the UI by data-agent-id) ───────────────────
/** In-page: the visible element for an agent id (skips hidden Ionic pages). */
const FIND = `(id) => [...document.querySelectorAll('[data-agent-id="' + id + '"]')]
  .find((e) => !e.closest('.ion-page-hidden') && e.getClientRects().length > 0)`;

function helpers(send) {
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value;
  };
  const exists = (id) => evaluate(`!!(${FIND})(${JSON.stringify(id)})`);
  const waitFor = async (id, ms = 8000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (await exists(id)) return true;
      await sleep(150);
    }
    return false;
  };
  const tap = async (id) => {
    const ok = await evaluate(`(() => { const e = (${FIND})(${JSON.stringify(id)}); if (!e) return false; e.click(); return true; })()`);
    if (!ok) console.warn(`  ! tap: ${id} not found`);
    await sleep(500);
    return ok;
  };
  const tapPrefix = async (prefix, suffix = '') =>
    evaluate(`(() => { const e = [...document.querySelectorAll('[data-agent-id^="${prefix}"]')]
      .find((x) => x.getAttribute('data-agent-id').endsWith('${suffix}') && !x.closest('.ion-page-hidden') && x.getClientRects().length);
      if (!e) return null; e.click(); return e.getAttribute('data-agent-id'); })()`).then(async (r) => {
      await sleep(500);
      return r;
    });
  const type = async (id, text) => {
    await evaluate(`(() => { const e = (${FIND})(${JSON.stringify(id)}); const input = e?.matches('input,textarea') ? e : e?.querySelector('input,textarea');
      if (!input) return false; const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, ${JSON.stringify(text)});
      input.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
    await sleep(500);
  };
  const ids = () =>
    evaluate(`[...document.querySelectorAll('[data-agent-id]')]
      .filter((e) => !e.closest('.ion-page-hidden') && e.getClientRects().length)
      .map((e) => e.getAttribute('data-agent-id') + (e.getAttribute('data-agent-state') ? ' [' + e.getAttribute('data-agent-state') + ']' : ''))`);
  const go = async (route, readyId) => {
    await send('Page.navigate', { url: BASE + route });
    if (readyId && !(await waitFor(readyId, 15000))) console.warn(`  ! ${route}: ${readyId} never appeared`);
    await sleep(1200);
  };
  /** Closes whatever overlay is open: its own Cancel/close control first, then Ionic's dismiss. */
  const escape = async () => {
    await evaluate(`(() => { const c = [...document.querySelectorAll('[data-agent-id$=".cancel"], [data-agent-id$=".close"], .action-sheet-cancel, .kg-action-sheet__btn--cancel')]
      .find((e) => e.getClientRects().length); c?.click();
      document.querySelectorAll('ion-modal, ion-action-sheet, ion-alert, ion-popover').forEach((m) => m.dismiss?.()); })()`);
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(800);
  };
  /** Scrolls the visible IonContent by one screen; false at the end. */
  const scrollPage = () =>
    evaluate(`(async () => { const c = [...document.querySelectorAll('ion-content')].reverse()
      .find((x) => !x.closest('.ion-page-hidden') && x.getClientRects().length && !x.closest('ion-modal'))
      ?? document.querySelector('ion-modal ion-content'); if (!c) return false;
      const el = await c.getScrollElement(); const before = el.scrollTop;
      el.scrollTop = before + el.clientHeight * 0.85; return el.scrollTop > before; })()`);
  return { evaluate, exists, waitFor, tap, tapPrefix, type, ids, go, escape, scrollPage };
}

// ── In-page measurements (WCAG AA + design consistency) ─────────────────
/**
 * Per screen: text below AA contrast, tap targets under 44 px, and the set of
 * distinct colours / font sizes / radii / border widths actually rendered
 * (consistency: a token system should produce few distinct values).
 */
const AUDIT_JS = `(() => {
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(',').map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // Effective background; null over a gradient (checked by hand in design-tokens.md, not measurable here).
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const st = getComputedStyle(e);
    if (st.backgroundImage.includes('gradient')) return null; const c = parse(st.backgroundColor); if (c && c.a > 0.5) return c; } return { r: 248, g: 250, b: 252 }; };
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.opacity !== '0' && !e.closest('.ion-page-hidden'); };
  const label = (e) => (e.getAttribute('data-agent-id') || e.closest('[data-agent-id]')?.getAttribute('data-agent-id') || e.tagName.toLowerCase()) + ' "' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + '"';
  const contrast = [], targets = [], colors = {}, sizes = {}, radii = {}, borders = {};
  for (const e of document.querySelectorAll('body *')) {
    if (!visible(e)) continue;
    const s = getComputedStyle(e);
    const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const fg = parse(s.color), bg = bgOf(e); const px = parseFloat(s.fontSize); const bold = parseInt(s.fontWeight) >= 700;
      const large = px >= 24 || (bold && px >= 18.66); const r = bg ? ratio(fg, bg) : 99;
      if (r < (large ? 3 : 4.5)) contrast.push(r.toFixed(2) + ':1 ' + s.color + ' on rgb(' + [bg.r, bg.g, bg.b] + ') ' + px + 'px — ' + label(e));
      colors[s.color] = (colors[s.color] || 0) + 1; sizes[s.fontSize + ' e.g. ' + label(e)] = 1;
    }
    if (e.matches('button, a[href], input, select, textarea, [role="button"], ion-tab-button, ion-toggle')) {
      const r = e.getBoundingClientRect();
      if ((r.width < 44 || r.height < 44) && !e.closest('ion-tab-bar') ) targets.push(Math.round(r.width) + 'x' + Math.round(r.height) + ' — ' + label(e));
    }
    if (s.borderTopWidth !== '0px' && s.borderTopStyle !== 'none') borders[s.borderTopWidth + ' ' + s.borderTopColor + ' e.g. ' + label(e)] = 1;
    if (s.borderTopLeftRadius !== '0px') radii[s.borderTopLeftRadius + ' e.g. ' + label(e)] = 1;
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ×' + v);
  return { contrast: [...new Set(contrast)], targets: [...new Set(targets)], textColors: top(colors), fontSizes: top(sizes), radii: top(radii), borders: top(borders) };
})()`;

// ── Fake fixtures (drawn in the page; never real documents) ──────────────
const FIXTURES_JS = `(() => {
  const card = (title, lines, w = 1000, h = 630, bg = '#dbeafe') => new Promise((res) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = '#0f172a'; g.font = 'bold 54px sans-serif';
    g.fillText(title, 50, 100); g.font = '34px sans-serif'; lines.forEach((l, i) => g.fillText(l, 50, 200 + i * 60));
    g.fillStyle = '#94a3b8'; g.fillRect(w - 260, 160, 200, 240); g.fillStyle = '#ef4444'; g.font = 'bold 30px sans-serif';
    g.fillText('SAMPLE — NOT REAL', 50, h - 40); c.toBlob(res, 'image/png'); });
  const pdf = (title, pages) => {
    const objs = []; const kids = [];
    const font = 3; let n = 4;
    const pageObjs = pages.map((lines) => { const content = 'BT /F1 22 Tf 60 760 Td (' + title + ') Tj 0 -40 Td /F1 14 Tf ' +
      lines.map((l) => '(' + l + ') Tj 0 -24 Td').join(' ') + ' ET'; const pid = n++, cid = n++; kids.push(pid);
      return [pid, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + font + ' 0 R >> >> /Contents ' + cid + ' 0 R >>', cid, '<< /Length ' + content.length + ' >>\\nstream\\n' + content + '\\nendstream']; });
    objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'; objs[2] = '<< /Type /Pages /Kids [' + kids.map((k) => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
    objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'; pageObjs.forEach(([p, pb, c, cb]) => { objs[p] = pb; objs[c] = cb; });
    let out = '%PDF-1.4\\n'; const offs = [];
    for (let i = 1; i < objs.length; i++) { offs[i] = out.length; out += i + ' 0 obj\\n' + objs[i] + '\\nendobj\\n'; }
    const x = out.length; out += 'xref\\n0 ' + objs.length + '\\n0000000000 65535 f \\n' + offs.slice(1).map((o) => String(o).padStart(10, '0') + ' 00000 n \\n').join('');
    out += 'trailer\\n<< /Size ' + objs.length + ' /Root 1 0 R >>\\nstartxref\\n' + x + '\\n%%EOF';
    return new Blob([out], { type: 'application/pdf' }); };
  return Promise.all([
    card('PAN CARD', ['Name: SAMPLE PERSON', 'PAN: ABCDE1234F', 'DOB: 01/01/1990'], 1000, 630, '#e0f2fe').then((b) => new File([b], 'PAN Card.png', { type: 'image/png' })),
    card('AADHAAR (FRONT)', ['Name: SAMPLE PERSON', 'XXXX XXXX 1234', 'Gender: F'], 1000, 630, '#fef3c7').then((b) => new File([b], 'Aadhaar Front.png', { type: 'image/png' })),
    card('PASSPORT PHOTO', ['SAMPLE'], 600, 800, '#f1f5f9').then((b) => new File([b], 'Passport Photo.png', { type: 'image/png' })),
    Promise.resolve(new File([pdf('RENT AGREEMENT', [['Between SAMPLE OWNER and SAMPLE TENANT', 'Rent: Rs 15,000 per month'], ['Page 2: Terms', 'Deposit: Rs 45,000'], ['Page 3: Signatures']])], 'Rent Agreement.pdf', { type: 'application/pdf' })),
    Promise.resolve(new File([pdf('ELECTRICITY BILL', [['Consumer No: 000000000', 'Amount due: Rs 1,234', 'Mobile: 9876543210']])], 'Electricity Bill.pdf', { type: 'application/pdf' })),
  ]).then((files) => {
    // The web picker creates a hidden <input type=file> and click()s it:
    // hand it the fixtures instead of opening a dialog.
    const original = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function () {
      if (this.type !== 'file') return original.call(this);
      const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); this.files = dt.files;
      this.dispatchEvent(new Event('change'));
      HTMLInputElement.prototype.click = original;
    };
    return files.length;
  });
})()`;

// ── The walk ──────────────────────────────────────────────────────────────
async function run() {
  const { proc, profile, wsUrl } = await launch();
  const { ws, send } = await connect(wsUrl);
  const h = helpers(send);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: true });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true });

  let theme = 'light';
  let index = 0;
  const shot = async (name) => {
    const dir = path.join(OUT, `${theme}${LANG === 'en' ? '' : `-${LANG}`}`);
    mkdirSync(dir, { recursive: true });
    const file = `${String(++index).padStart(2, '0')}-${name}`;
    await sleep(500);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(dir, `${file}.png`), Buffer.from(data, 'base64'));
    writeFileSync(path.join(dir, `${file}.ids.txt`), (await h.ids()).join('\n') + '\n');
    const a = await h.evaluate(AUDIT_JS);
    const section = (title, list) => `## ${title} (${list.length})\n${list.join('\n')}\n`;
    writeFileSync(
      path.join(dir, `${file}.audit.md`),
      [section('Text below WCAG AA', a.contrast), section('Tap targets under 44 px', a.targets), section('Text colours', a.textColors),
        section('Font sizes', a.fontSizes), section('Corner radii', a.radii), section('Borders', a.borders)].join('\n')
    );
    console.log(`  ✓ ${theme}/${file}`);
  };
  /** Screenshot a long page screen by screen. */
  const shotScroll = async (name, max = 4) => {
    await shot(name);
    for (let i = 2; i <= max && (await h.scrollPage()); i++) {
      await sleep(400);
      await shot(`${name}-${i}`);
    }
  };

  // First launch: clean slate, chosen language, onboarding shown.
  await h.go('/');
  await h.evaluate(`(async () => { localStorage.clear(); localStorage.setItem('i18nextLng', '${LANG}');
    for (const db of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(db.name); })()`);

  for (const t of THEMES) {
    theme = t;
    index = 0;
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: t }] });
    await h.evaluate(`localStorage.setItem('kagaz:theme', '${t}')`);
    console.log(`\n[${t}]`);

    // Onboarding (only before it was completed once).
    await h.evaluate(`localStorage.removeItem('kagaz:onboarding-seen')`);
    await h.go('/vault', 'app.onboarding');
    for (let step = 1; step <= 6 && (await h.exists('app.onboarding.next')); step++) {
      await shot(`onboarding-${step}`);
      await h.tap('app.onboarding.next');
    }
    await shot('onboarding-last');
    (await h.tap('app.onboarding.get-started')) || (await h.tap('app.onboarding.skip'));
    await h.waitFor('vault.home');

    // Seed once (first theme), capturing the empty state first.
    if (await h.waitFor('vault.home.empty-state', 4000)) {
      await shot('vault-empty');
      await h.evaluate(FIXTURES_JS);
      await h.tap('vault.home.upload-fab');
      await shot('upload-fab-open');
      if (await h.exists('vault.home.upload-fab-upload')) await h.tap('vault.home.upload-fab-upload');
      await h.waitFor('vault.home.upload-source-files', 4000);
      await shot('upload-sheet');
      await h.tap('vault.home.upload-source-files');
      await sleep(3000);
      await shot('vault-after-upload');
      // Dismiss rename prompts (UX-8) if they queued up.
      for (let i = 0; i < 6; i++) {
        const btn = await h.evaluate(`(() => { const b = [...document.querySelectorAll('ion-alert button')].pop(); if (!b) return false; b.click(); return true; })()`);
        if (!btn) break;
        await sleep(500);
      }
    }

    await h.go('/vault', 'vault.home');
    await shotScroll('vault-home', 3);
    for (const mode of ['grid', 'compact', 'list']) {
      if (await h.tapPrefix('vault.home.view-mode', mode)) await shot(`vault-view-${mode}`);
    }
    await h.type('vault.home.search', 'rent');
    await shot('vault-search');
    await h.go('/vault', 'vault.home');
    if (await h.tapPrefix('vault.home.item-', '.more')) {
      await shot('vault-item-menu');
      await h.escape();
    }
    if (await h.tap('vault.home.filter-button')) {
      await shot('vault-filter-panel');
      await h.escape();
    }
    if (await h.tap('app.menu-button')) {
      await sleep(600);
      await shot('drawer');
      await h.evaluate(`document.querySelector('ion-menu')?.close()`);
    }
    await h.tapPrefix('vault.home.item-', '.favorite');

    // Viewer: a PDF and an image.
    await h.go('/vault', 'vault.home');
    for (const kind of ['pdf', 'image']) {
      const opened = await h.evaluate(`(() => { const rows = [...document.querySelectorAll('[data-agent-id^="vault.home.item-"]')]
        .filter((e) => /^vault\\.home\\.item-[^.]+$/.test(e.getAttribute('data-agent-id')));
        const row = rows.find((e) => ${kind === 'pdf' ? "/Rent|Bill/" : "/PAN|Aadhaar|Photo/"}.test(e.textContent)); if (!row) return false; row.click(); return true; })()`);
      if (!opened) continue;
      await h.waitFor('vault.viewer.content', 10000);
      await sleep(1500);
      await shotScroll(`viewer-${kind}`, 2);
      if (await h.tap('vault.viewer.more')) {
        await shot(`viewer-${kind}-menu`);
        await h.escape();
      }
      await h.go('/vault', 'vault.home');
    }

    // Tab roots.
    await h.go('/favorites', 'vault.favorites');
    await shot('favorites');
    await h.go('/storage', 'vault.storage');
    await shotScroll('storage', 2);

    // PDF tools: hub, every tool sheet, a real run → result + history.
    await h.go('/pdf-tools', 'pdf-tools');
    await shotScroll('pdf-tools', 3);
    const ops = await h.evaluate(`[...document.querySelectorAll('[data-agent-id^="pdf-tools.op-"]')].map((e) => e.getAttribute('data-agent-id'))
      .filter((id) => /^pdf-tools\\.op-[a-zA-Z]+$/.test(id) && id !== 'pdf-tools.op-sheet')`);
    for (const op of ops) {
      await h.go('/pdf-tools', 'pdf-tools');
      await h.tap(op);
      await sleep(800);
      await shot(`tool-${op.replace('pdf-tools.op-', '')}`);
    }
    await h.go('/pdf-tools', 'pdf-tools');
    await h.tap('pdf-tools.op-compress');
    await sleep(800);
    if (await h.tapPrefix('pdf-tools.picker.item-')) {
      await shot('tool-compress-picked');
      await h.tap('pdf-tools.op-sheet.run');
      const done = await h.waitFor('pdf-tools.result', 45000);
      await sleep(1200);
      await shot('tool-result');
      if (!done) console.warn('  ! result sheet never opened: ' + (await h.evaluate(`document.querySelector('[data-agent-id="pdf-tools.op-sheet.error"]')?.textContent ?? 'no error shown'`)));
      await h.tap('pdf-tools.result.done');
      await sleep(800);
      await shotScroll('pdf-tools-history', 3);
    }

    // Drawer destinations and settings.
    for (const [route, id, name] of [
      ['/quick-reference', 'vault.quick-reference', 'quick-reference'],
      ['/quick-notes', 'vault.quick-notes', 'quick-notes'],
      ['/archived', 'vault.archived', 'archived'],
      ['/trash', 'vault.trash', 'trash'],
      ['/ai-assistant', 'ai.settings', 'ai-model'],
      ['/ai-chat', 'ai.chat', 'ai-chat'],
      ['/legal/privacy', 'settings.legal', 'legal-privacy'],
      ['/legal/licenses', 'settings.legal', 'legal-licenses'],
    ]) {
      await h.go(route, id);
      await shot(name);
    }
    await h.go('/settings', 'settings');
    await shotScroll('settings', 6);
  }

  writeFileSync(path.join(OUT, 'console.log'), consoleLines.join('\n') + '\n');
  ws.close();
  proc.kill();
  rmSync(profile, { recursive: true, force: true });
  console.log(`\nScreens → ${path.relative(process.cwd(), OUT)}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
