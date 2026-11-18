# Browser Web Demo (testing only)

> **Web Demo** · Last Updated: 2026-11-18 · Decision: [ADR-025](../architecture/08-tech-stack-decisions.md#adr-025-browser-web-demo--dev-server-only-testing-only)

The web demo runs Kagaz in a desktop browser so you can test the vault UI without a phone. It is **never** part of a store build.

## Contents

- [Start it](#start-it)
- [What works](#what-works)
- [Why it can never reach production](#why-it-can-never-reach-production)
- [Rules](#rules)

## Start it

```bash
pnpm --filter kagaz dev:web-demo     # = VITE_WEB_DEMO=1 vite
```

Open the printed URL in Chrome. Use DevTools → device toolbar (Cmd+Shift+M, about 412 px wide) for a phone layout.

## What works

| Area | In the browser |
|---|---|
| Vault: upload, folders, tags, search, viewer, PDF tools, image tools, Quick Reference, Notes | ✅ (stored in an **unencrypted** in-browser sql.js database, persisted to IndexedDB) |
| OCR (ML Kit), scanner, biometric lock, share sheet | ❌ native only |
| AI assistant (on-device Gemma) | ❌ Android only. The AI section is hidden. Desktop AI testing with Ollama is future item [AI-X5](../roadmap/future-extensions.md#ai-x5--desktop-ai-testing-with-ollama) |
| Voice input | Depends on the browser's Web Speech support |

## Why it can never reach production

- `vite-plugins/web-demo.ts` has `apply: 'serve'`, so `vite build` never runs it. It serves the sql.js WASM and adds `'wasm-unsafe-eval'` to the **dev server's** CSP only.
- `__KAGAZ_DEMO__` is `command === 'serve' && VITE_WEB_DEMO === '1'`. In every build it is the constant `false`, and the demo database code is removed.
- A build with `VITE_WEB_DEMO` set fails with an error.
- The checks run in `vite-plugins/__tests__/web-demo.test.ts`. The release check is in ADR-025: diff the `dist/index.html` CSP against the source and grep `dist` for demo code.

## Rules

- Use **fake documents only**. The browser database is not encrypted.
- Never point a store build or a CI release job at `dev:web-demo`.
- The old hackathon runbook (Ollama + Vertex AI, `scripts/demo-start.sh`) lives on the branch `feature/ai-ollama-embeddings`.
