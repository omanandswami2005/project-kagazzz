#!/usr/bin/env node
/**
 * Text-first device E2E driver for Kagaz.
 *
 * Drives the debuggable Capacitor WebView over the Chrome DevTools Protocol,
 * addressing the UI by `data-agent-id` (agent-interface.md) instead of pixel
 * taps + screenshots. Zero dependencies — uses Node's global fetch/WebSocket.
 *
 * Prereqs: a debug build installed and running on an emulator/device, `adb`
 * on PATH. See docs/guides/device-verification.md §Text-first verification.
 *
 * Commands (each opens a fresh CDP connection; adb forward is idempotent):
 *   node cdp.mjs dump                 # list every [data-agent-id] on screen (id, tag, state, text)
 *   node cdp.mjs tap   <agent-id>     # click the element (React onClick fires)
 *   node cdp.mjs type  <agent-id> <s> # set an <input>/<textarea> value the React way
 *   node cdp.mjs text  <agent-id>     # print textContent
 *   node cdp.mjs state <agent-id>     # print data-agent-state
 *   node cdp.mjs wait  <agent-id> [ms]# block until present (default 8000ms) — exit 0/1
 *   node cdp.mjs gone  <agent-id> [ms]# block until absent
 *   node cdp.mjs eval  "<js>"         # evaluate arbitrary JS in the page, print JSON result
 *
 * Env: KAGAZ_APP_ID (default in.kagaz.app), KAGAZ_CDP_PORT (9222), ADB (adb).
 */
import { execFileSync } from 'node:child_process';

const APP_ID = process.env.KAGAZ_APP_ID ?? 'in.kagaz.app';
const PORT = process.env.KAGAZ_CDP_PORT ?? '9222';
const ADB = process.env.ADB ?? 'adb';

const adb = (args) => execFileSync(ADB, args, { encoding: 'utf8' });

/** Idempotently forward a local TCP port to the app's WebView devtools socket. */
function ensureForward() {
  const pid = adb(['shell', 'pidof', '-s', APP_ID]).trim();
  if (!pid) throw new Error(`${APP_ID} is not running on the device`);
  adb(['forward', `tcp:${PORT}`, `localabstract:webview_devtools_remote_${pid}`]);
  return pid;
}

/** Find the WebSocket URL of the app's WebView page target. */
async function targetWsUrl() {
  const pages = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const page =
    pages.find((p) => p.type === 'page' && /https?:\/\/localhost/.test(p.url ?? '')) ??
    pages.find((p) => p.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('no debuggable WebView page found');
  return page.webSocketDebuggerUrl;
}

/** Minimal CDP client over a single WebSocket. */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let seq = 0;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', () => rej(new Error('CDP websocket error')));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    const p = msg.id && pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

/** Evaluate an expression in the page and return its value. */
async function evaluate(conn, expression) {
  const { result, exceptionDetails } = await conn.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? 'evaluation threw');
  }
  return result.value;
}

/** JS-string literal for safe interpolation of an agent id. */
const q = (s) => JSON.stringify(String(s));

const SNIPPETS = {
  dump: () =>
    `[...document.querySelectorAll('[data-agent-id]')].map(e=>({` +
    `id:e.getAttribute('data-agent-id'),tag:e.tagName.toLowerCase(),` +
    `state:e.getAttribute('data-agent-state'),` +
    `disabled:e.disabled===true||e.getAttribute('aria-disabled')==='true',` +
    `text:(e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,48)}))`,
  tap: (id) =>
    `(()=>{const e=document.querySelector('[data-agent-id='+${q(q(id))}+']');` +
    `if(!e)return{ok:false};e.scrollIntoView({block:'center'});e.click();return{ok:true};})()`,
  type: (id, val) =>
    `(()=>{const e=document.querySelector('[data-agent-id='+${q(q(id))}+']');` +
    `if(!e)return{ok:false};const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement:HTMLInputElement;` +
    `const set=Object.getOwnPropertyDescriptor(proto.prototype,'value').set;set.call(e,${q(val)});` +
    `e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return{ok:true};})()`,
  text: (id) =>
    `(()=>{const e=document.querySelector('[data-agent-id='+${q(q(id))}+']');` +
    `return e?(e.textContent||'').replace(/\\s+/g,' ').trim():null;})()`,
  state: (id) =>
    `(()=>{const e=document.querySelector('[data-agent-id='+${q(q(id))}+']');` +
    `return e?e.getAttribute('data-agent-state'):null;})()`,
  present: (id) =>
    `!!document.querySelector('[data-agent-id='+${q(q(id))}+']')`,
};

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);
  if (!cmd) throw new Error('usage: cdp.mjs <dump|tap|type|text|state|wait|gone|eval> [args]');

  ensureForward();
  const conn = connect(await targetWsUrl());
  await conn.ready;
  await conn.send('Runtime.enable');

  const pollUntil = async (want) => {
    const timeout = Number(arg2 ?? 8000);
    const deadline = Date.now() + timeout;
    // Date.now is fine here — this is a CLI helper, not a workflow script.
    for (;;) {
      if ((await evaluate(conn, SNIPPETS.present(arg1))) === want) return true;
      if (Date.now() > deadline) return false;
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  let out;
  let code = 0;
  switch (cmd) {
    case 'dump':
      out = await evaluate(conn, SNIPPETS.dump());
      break;
    case 'tap':
      out = await evaluate(conn, SNIPPETS.tap(arg1));
      if (!out?.ok) code = 1;
      break;
    case 'type':
      out = await evaluate(conn, SNIPPETS.type(arg1, arg2 ?? ''));
      if (!out?.ok) code = 1;
      break;
    case 'text':
      out = await evaluate(conn, SNIPPETS.text(arg1));
      break;
    case 'state':
      out = await evaluate(conn, SNIPPETS.state(arg1));
      break;
    case 'wait':
      out = { present: await pollUntil(true) };
      if (!out.present) code = 1;
      break;
    case 'gone':
      out = { gone: await pollUntil(false) };
      if (!out.gone) code = 1;
      break;
    case 'eval':
      out = await evaluate(conn, arg1);
      break;
    default:
      throw new Error(`unknown command: ${cmd}`);
  }
  conn.close();
  process.stdout.write(typeof out === 'string' ? out + '\n' : JSON.stringify(out, null, 2) + '\n');
  process.exit(code);
}

main().catch((err) => {
  process.stderr.write(`device-e2e: ${err.message}\n`);
  process.exit(2);
});
