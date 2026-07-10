# Device Verification Guide — Humans & Agents

> **Project:** Kagaz
> **Purpose:** How to build, install, and exercise the app on an Android emulator/device to satisfy the mandatory device-verification gate before closing a checklist item.
> **Last Updated:** 2026-07-10

This guide is the **operational companion** to [DEVELOPMENT-CHECKLIST.md](../../DEVELOPMENT-CHECKLIST.md) protocol **step 5** (*"Device verification (mandatory before closing any device-affecting item)"*). The checklist defines **what** must be verified; this guide defines **how** — the exact terminal commands to boot an emulator, produce a debug APK, install it, and drive the flow, plus a copy-paste journal template.

**Why this gate exists:** green unit gates are not evidence the app works. Mocks hide config/runtime mismatches, jsdom has no pixels, and no test env has an Android hardware back button. F-1 shipped with 100% green gates yet a dead upload FAB, unreadable dark mode, and a broken back button — all invisible to the test suite. Any offline/CSP/WASM problem (see [CLAUDE.md](../../CLAUDE.md) media-library rule) only surfaces on-device.

---

## Table of Contents

- [1. When an item is "device-affecting"](#1-when-an-item-is-device-affecting)
- [2. One-time machine setup (macOS)](#2-one-time-machine-setup-macos)
- [3. The verify loop](#3-the-verify-loop)
- [4. Text-first driving (preferred over screenshots)](#4-text-first-driving-preferred-over-screenshots)
- [5. The step-5 checklist (per item)](#5-the-step-5-checklist-per-item)
- [6. Journal template](#6-journal-template)
- [7. Troubleshooting](#7-troubleshooting)

---

## 1. When an item is "device-affecting"

Run this gate before checking the box when the item touches any of:

- **native plugin APIs or `capacitor.config.ts`** (SQLite/SQLCipher, filesystem, camera, biometrics, …);
- **theming / design tokens** (dark mode, contrast, density);
- **navigation / routing** (new screens, back behaviour);
- **permissions**;
- **filesystem / secure storage**.

Pure-logic items with no runtime surface (a pure geometry helper, a type, a doc) do **not** need it — but if in doubt, verify. Every open Lane-B PDF op (F-3…F-7, F-21, F-22, F-28) and F-2 are currently blocked on exactly this gate.

---

## 2. One-time machine setup (macOS)

Kagaz drives Android from the **command line** (agents can't click Android Studio's GUI). You need the Android SDK's `adb` + `emulator` on `PATH` and a JDK. Android Studio bundles a JBR (Java 21 here), so you don't need a separate JDK install.

Add this block to `~/.zshrc` (already done on the maintainer's machine — reproduce it on a fresh checkout):

```bash
# --- Android SDK + JDK (Kagaz dev) ---
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$JAVA_HOME/bin:$PATH"
# --- end Android SDK ---
```

Then `source ~/.zshrc` (or open a new shell) and verify — all four must succeed:

```bash
adb version              # -> Android Debug Bridge version 1.0.41
java -version            # -> openjdk version "21.x"  (Studio JBR)
emulator -list-avds      # -> Medium_Phone  (at least one AVD)
node -v && pnpm -v       # Node >= 22.12, pnpm >= 10
```

If `emulator -list-avds` is empty, create one in Android Studio → **Device Manager** (a "Medium Phone", **API 24+** system image — API 24 is our primary target), or via `avdmanager`.

> **First-time deps:** `pnpm install` at the repo root (installs the whole workspace; ~6 min cold). Android Studio must have downloaded the SDK/NDK at least once so `apps/kagaz/android/` can build.

---

## 3. The verify loop

Run from the repo root. Steps 2–4 are the inner loop you repeat per change.

**1 — Boot the emulator** (once per session; leave it running):

```bash
emulator -avd Medium_Phone &        # or your AVD name from -list-avds
adb wait-for-device                 # blocks until the device registers
adb shell getprop sys.boot_completed # prints 1 when fully booted
adb shell dumpsys user | grep RUNNING_UNLOCKED # must be unlocked before launch
```

**2 — Build the web bundle + sync native:**

```bash
pnpm --filter kagaz build:capacitor  # = vite build && cap sync (copies dist/ into android/)
```

**3 — Assemble + install the debug APK:**

```bash
cd apps/kagaz/android
./gradlew assembleDebug              # macOS/Linux — NOT gradlew.bat
adb install -r app/build/outputs/apk/debug/app-debug.apk
cd ../../..
```

**4 — Launch and drive:**

```bash
adb shell monkey -p in.kagaz.app -c android.intent.category.LAUNCHER 1  # cold launch
adb logcat --pid=$(adb shell pidof -s in.kagaz.app)                     # watch app logs
adb exec-out screencap -p > /tmp/kagaz-verify.png                       # capture evidence
```

- App id is **`in.kagaz.app`** (from `capacitor.config.ts` / `android/app/build.gradle`).
- Useful helpers: `adb shell input keyevent KEYCODE_BACK` (hardware back), `adb shell "cmd uimode night yes|no"` (toggle dark mode), set the app locale to Hindi via device Settings → Languages, or launch with a locale override.

> **Shortcut:** steps 2–3 are wrapped by `pnpm --filter kagaz build:android` (`build:capacitor` + `./gradlew assembleDebug`); then run only the `adb install -r …` line from step 3. Run the steps unwrapped when you need to see where a build breaks.

---

## 4. Text-first driving (preferred over screenshots)

**Reading screenshots is expensive and fragile** (pixel taps drift, and vision is costly for an agent). Kagaz is a debuggable Capacitor **WebView** instrumented with `data-agent-id` on every interactive element ([agent-interface.md](../design-system/agent-interface.md)), so drive and assert it in **text** instead — over the Chrome DevTools Protocol, addressing the UI by agent id. Screenshots then become an occasional *visual* spot-check (dark-mode contrast, layout), not the way you check flow logic.

Two signals, used together:

1. **CDP driver** — [`scripts/device-e2e/cdp.mjs`](../../scripts/device-e2e/cdp.mjs) (zero-dep Node; forwards a port to the WebView devtools socket and talks CDP). Address elements by `data-agent-id`:

   ```bash
   node scripts/device-e2e/cdp.mjs dump                         # every [data-agent-id] on screen (id, tag, state, text)
   node scripts/device-e2e/cdp.mjs tap  pdf-tools.op-split       # click (React onClick fires)
   node scripts/device-e2e/cdp.mjs type pdf-tools.op-sheet.ranges "1-2, 3-5"   # set an input the React way
   node scripts/device-e2e/cdp.mjs wait pdf-tools.saved-toast    # block until present → exit 0/1
   node scripts/device-e2e/cdp.mjs text pdf-tools.op-sheet.run   # read textContent / state
   ```

   `dump` is the cheap "what's on screen + what can I tap" — start there to discover ids, then `tap`/`type`/`wait`. No pixel coordinates, no screenshots. (`uiautomator dump` is useless here — Ionic renders inside a single WebView node, opaque to it.)

2. **logcat event assertions** — the app emits structured pino events to logcat ([observability-logging.md](../architecture/14-observability-logging.md)); assert on the event id instead of eyeballing a toast. The engine event names match the Action Registry op ids:

   ```bash
   adb logcat -c                                            # clear before the action
   # …drive the op via CDP…
   adb logcat -d | grep -aoE '"operation":"splitPdf"|worker.request.success|vault.upload.start'
   ```

   `worker.request.success` = the op actually ran in the worker; each `vault.upload.start` = one output saved. (This is how F-3/F-4 were verified: `mergePdfs`/`splitPdf` → `worker.request.success` → the right number of `vault.upload.start`.)

**Recipe:** `logcat -c` → CDP `tap`/`type` the flow → `grep` the expected events → CDP `dump`/`text` to confirm the resulting UI/vault state. Fall back to `screencap` only for the visual checks in §5 (dark mode, Hindi readability).

---

## 5. The step-5 checklist (per item)

Verify **all** of these on the running device before checking the box. Copy the template in §6 and fill each line.

- [ ] **Cold start** — the app boots to the expected screen with no silently degraded state (empty vault, disabled FAB = a failure, not "empty").
- [ ] **Primary flow end-to-end** — exercise the item's core path on-device (e.g. PDF merge: pick 2 PDFs → merge → result opens/saves → survives an app restart).
- [ ] **Dark mode** — flip it; every new screen stays readable (token-driven contrast, no hardcoded colors).
- [ ] **Hindi locale** — switch to `hi`; every new screen is translated (no raw i18n keys) and readable.
- [ ] **Hardware back** — press it from every new screen: sane navigation, and the app leaves cleanly from the root.
- [ ] **Offline sanity** — the op runs with no network (V1 is 100% offline); watch logcat for any CDN/WASM fetch failure (see §7).

---

## 6. Journal template

Paste this into the item's checklist line (or the Commit Journal) once green, replacing the placeholders:

```
Device-verified on <AVD name, API level> (<date>): cold start ✓, <primary flow> ✓,
dark mode ✓, hi locale ✓, hardware back ✓, offline ✓. <anything notable / follow-ups>.
```

Example (F-6 PDF → Image):

```
Device-verified on Medium_Phone API 34 (2026-07-08): cold start ✓, pick PDF → render
each page to PNG → images appear + persist across restart ✓, dark mode ✓, hi locale ✓,
hardware back returns to PDF Tools hub ✓, offline (airplane mode) ✓.
```

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `adb: no devices/emulators found` | emulator not booted, or `adb`/`emulator` not on PATH | §2 setup; `adb wait-for-device`; `adb kill-server && adb start-server` |
| `adb install` says `Success`, but launcher/`monkey` says `No activities found to run`, or `am start` says `Activity class ... does not exist` | the AVD user is still locked (`dumpsys user` shows `RUNNING_LOCKED`), so Android hides non-direct-boot launcher activities | wake + unlock the emulator first (`adb shell input keyevent KEYCODE_WAKEUP`; swipe up; enter the test PIN if one was set, e.g. `adb shell input text 1234 && adb shell input keyevent ENTER`), then confirm `RUNNING_UNLOCKED` before launch |
| `./gradlew: command not found` or `.bat` error | wrong wrapper for the OS | use `./gradlew assembleDebug` on macOS/Linux (native Windows: `gradlew.bat`) |
| `JAVA_HOME is not set` / wrong Java | JDK not exported | point `JAVA_HOME` at Studio's JBR (§2) |
| App boots to **empty vault / disabled FAB** | SQLCipher not activated → DB failed to open | check `CapacitorSQLite` encryption flags in `capacitor.config.ts`; read logcat for the real DB error |
| A media op (PDF/image/OCR) **fails on-device only** | library fetches a worker/WASM/model from a CDN at runtime → blocked on the zero-network app | grep the lib's `dist/` for `workerSrc\|jsdelivr\|wasmUrl\|GlobalWorkerOptions`; bundle the asset locally or swap the lib. This is exactly why F-5 dropped `@quicktoolsone/pdf-compress`. See the media-library rule in [CLAUDE.md](../../CLAUDE.md) and [08-tech-stack-decisions.md](../architecture/08-tech-stack-decisions.md) ADR-017. |
| WASM op throws a CSP error | Emscripten/Go runtime needs `wasm-unsafe-eval` | evaluate against the strict offline CSP on this PII app before adding — often a reason to reject the lib |
| Dark mode unreadable / raw `key.path` text | hardcoded colors / missing i18n | fix tokens (`design-tokens.md`) / add `en`+`hi` strings — both are step-5 failures |
| **Upload never happens after the file picker** (app pid changed; no `vault.upload.*` in logcat) | a low-RAM AVD **kills the backgrounded app while the native picker is open**, so the returned file has no WebView chooser to deliver to | retry (it's intermittent); or use a **larger-RAM AVD or a real device** for any verification that must seed a new file via upload. Flows that reuse existing vault docs (most PDF ops) are unaffected. This is why **F-28 Form Filling** can't have its fill happy-path device-verified on the default `Medium_Phone` AVD — finish it on a real device. |

When a media op fails with a generic message, **read the library's real underlying error in logcat and grep its bundle** before writing a workaround.

> **Verifying without the native picker (preferred where possible):** most PDF ops consume documents already in the vault, so seed the vault once and reuse. Uploading a *brief* new file (camera/gallery/files) triggers the native picker and its app-kill risk — avoid it in automated passes unless the item under test is the upload itself.
