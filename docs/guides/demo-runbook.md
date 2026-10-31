# Live Demo Runbook

> **Kagaz — hackathon demo** · Last Updated: 2026-10-31

Everything here was rehearsed in a real browser (headless Chrome driving the dev server) on 2026-10-31. Timings are what was measured, not promises.

## Contents
- [Before the judges arrive](#before-the-judges-arrive)
- [The 4-minute demo](#the-4-minute-demo)
- [If something goes wrong](#if-something-goes-wrong)
- [Avoid these (known weak spots)](#avoid-these-known-weak-spots)
- [Talking points (all measured)](#talking-points-all-measured)

## Before the judges arrive

1. `./scripts/demo-start.sh` — starts local Gemma (Ollama), warms it, starts the app, and checks Google Cloud. Every line must show ✅.
2. Open **http://localhost:5173** in Chrome. Use DevTools → device toolbar (Cmd+Shift+M) at ~412 px for a phone view.
3. Skip the onboarding. **Do not restart the dev server or reload the page mid-demo** — the AI connection lives in memory and a reload drops it (reconnect on the AI screen takes one tap).
4. Sample files are in `~/Desktop/kagaz-demo-files` (all fake data): *Passport photo.jpg*, *Rent agreement.pdf*, *Electricity bill.pdf*, *PAN card (sample).png*.
5. Optional: pre-upload the four files (Documents → **+** → Upload → Files → pick all four) so the demo starts with a full vault.

## The 4-minute demo

| # | Say / do | Expect | Time |
|---|---|---|---|
| 1 | **Kagaz AI** screen → flip **Online mode** | A plain-language warning that data goes to Google Cloud. Tap *Turn on online mode* → "Running on CLOUD". *Point out: one switch, and an honest warning.* | instant |
| 2 | Chat: `Switch to dark mode.` | App turns dark. Gemini calls a real tool. | ~2 s |
| 3 | Chat: `Resize my passport photo for a government form.` | The model shows a **form** (Width / Height / Max file size). Enter 200, 230, 50 → Send → a **Created: Passport photo_resized** card with *Open*. | ~8 s |
| 4 | Chat: `Merge my rent agreement and my electricity bill into one PDF.` | **Created: Merged document** card. *Scanned PDFs, merged in the browser.* | ~8 s |
| 5 | Documents → open *PAN card (sample)* → **Transcribe with Gemma** | English **and Hindi** text appear. *Vision model reading an ID-style card.* | ~2 s |
| 6 | **Kagaz AI** → flip **Online off** → **Connect to Gemma** → chat `Switch to dark mode.` | Badge says **Offline**; *local Gemma on this laptop* does it. **First answer ≈ 40 s — keep talking** (see below). | ~40 s |

**Talk over step 6:** "This is Gemma 4 E2B on an Intel laptop with no GPU, about 22 tokens a second. Same assistant, same tools — nothing leaves the machine. The online switch is the speed/privacy choice, and the user makes it."

## If something goes wrong

| Symptom | Fix |
|---|---|
| Chat shows "Manage AI Assistant" (not connected) | Page reloaded. Kagaz AI screen → Connect (offline) or flip Online. One tap. |
| Online says "not available" | `gcloud auth application-default login`, then retry. Fall back to step 6 (offline) — it needs no internet. |
| Offline says Ollama unreachable | `./scripts/demo-start.sh` again. |
| The model answers in text instead of showing a form | Rephrase once: `Resize my passport photo — I need to give you the sizes.` |
| A step is slow | Narrate; all steps finish. Online ≈ 2–8 s, offline ≈ 40 s first, then similar. |

## Avoid these (known weak spots)

Measured in live tests against the real models — they fail consistently, so don't try them on stage:
- `Add a watermark to my rent agreement` — the model asks for the text in plain chat instead of showing the form.
- A two-part request such as *"merge these and also resize that"* — it does the first part and stops.
- Don't claim accuracy numbers. Honest line: "tested live against the real models; tool calling is reliable on single requests, and we found and fixed several real bugs that way."

## Talking points (all measured)

- **One switch** between on-device/local and Google Cloud; flipping it online shows a data-sharing warning first.
- **Gemma 4 E2B locally**: ~22 tokens/s on an Intel i9, 16 GB, no GPU. Cloud replies in ~2.5 s.
- **Skills**: tools load on demand — the first prompt shrinks from 1,822 to 660 tokens (core only; −34 % for a PDF-only chat).
- **Gemma vision** reads English + Hindi document images; semantic search (`ai.semanticSearch`) works only on the dev server (Ollama EmbeddingGemma or Vertex embeddings); the APK has no embedding backend, and scanned PDFs without a text layer are not yet searchable.
- **Demo build only.** The browser database is unencrypted and the cloud proxy exists only in the dev server — neither can be in a release build (the build refuses). Production is an encrypted Android app.
