# Store Release Checklist — Google Play + Apple App Store (V1 / V1.5)

> **Store Release Checklist** · Last Updated: 2026-11-18 · Owner: release lead. Status of each line is mirrored in `DEVELOPMENT-CHECKLIST.md` (G1-x, G1.5-x, **G-STORE-x**).

This is the single list of what must be true before Kagaz is submitted to either store. "✅ code" means the repo is done. Items marked **you** need a person: an account, a signature, legal counsel or a real device.

## Table of Contents

- [Release scope](#release-scope)
- [Both stores](#both-stores)
- [Google Play](#google-play)
- [Apple App Store](#apple-app-store)
- [Build commands](#build-commands)
- [Known gaps found on 2026-11-18](#known-gaps-found-on-2026-11-18)

## Release scope

| Platform | Ships | Not in this release |
|---|---|---|
| Android | V1 vault + V1.5 on-device AI (Gemma 4 E2B via LiteRT-LM, optional ~2.6 GB download), voice input | Semantic search, online mode, Gemma vision ([future-extensions](../roadmap/future-extensions.md)) |
| iOS | V1 vault, voice input | On-device AI (AI-X4); the AI section is hidden |
| Web demo | **Never shipped**: dev-server only ([ADR-025](../architecture/08-tech-stack-decisions.md#adr-025-browser-web-demo--dev-server-only-testing-only)) | — |

## Both stores

- [ ] **Privacy policy finalized by Indian counsel and published** at a public URL (G1-5). The draft now covers on-device AI, the model download and voice input (2026-11-18). **you**
- [ ] Terms & Conditions published (G1-5). **you**
- [ ] Grievance officer name and contact in the policy (IT Rules 2021 / DPDP). **you**
- [x] No analytics, ads, tracking, crash-reporting SDKs ✅ code (10-security §3.5).
- [x] Release bundle contains no demo code and the strict CSP is unchanged ✅ code, verified 2026-11-18 (ADR-025).
- [x] AI tools refuse locked documents; destructive tool calls need confirmation ✅ code (10-security §5.3).
- [x] Model download is user-tapped, size shown first, SHA-256-verified before every load, and atomic (`.part`) ✅ code.
- [x] A downloaded model is remembered across restarts; Delete is confirmed and always reachable while the file is on disk ✅ code (05 §3.4.1).
- [ ] Third-party licences screen lists every runtime dependency, including the Gemma 4 model notice (Apache-2.0) and the LiteRT fork (MPL-2.0). Re-generate and check. **you / code**
- [ ] `pnpm audit` clean (no high/critical). Run before each submission.
- [ ] WCAG 2.1 AA: TalkBack + VoiceOver walkthrough on hardware (G1-3). **you**
- [ ] Performance budgets: Lighthouse ≥ 90 on mid-range Android (G1-4, last measured 0.8).
- [ ] Hindi + English store listing text, screenshots for phone + tablet. **you**
- [ ] Age rating questionnaires completed. **you**

## Google Play

- [ ] Play Console account, app created with package `in.kagaz.app`. **you**
- [ ] **Release signing:** Play App Signing enrolled; an upload keystore created and stored outside the repo (never committed). Add a `release` `signingConfig` reading from environment or `keystore.properties` (git-ignored). **you / code**
- [ ] **Version:** `versionCode` / `versionName` are still `1` / `"1.0"` in `android/app/build.gradle`. Wire them to `package.json` `version` before the first upload (every upload needs a higher `versionCode`).
- [x] `targetSdkVersion 36` / `minSdkVersion 24` ✅ code (meets Play's target-API rule).
- [ ] Build an **AAB** (`bundleRelease`), not an APK, for upload.
- [ ] **Shrinking:** `minifyEnabled false` today. Enabling R8 needs keep rules for Capacitor, ML Kit and LiteRT-LM (JNI). Decide, then test the release build on a device.
- [x] Permissions declared by the app: `RECORD_AUDIO` only. Merged: `INTERNET` + `ACCESS_NETWORK_STATE` (ML Kit scanner, LiteRT model download). Broad storage permissions removed from the LiteRT plugin ✅ code (2026-11-18).
- [ ] Re-check the **merged release manifest** (`aapt dump permissions` on the AAB/APK) after the storage-permission removal and paste the result into G1-6. **you / device**
- [ ] **Data safety form** per [play-data-safety.md](play-data-safety.md) (G1-6, G1.5-4). **you**
- [ ] **Large download disclosure:** the store listing says AI needs a one-time ~2.6 GB Wi-Fi download and a recent phone. The download is model weights, not code (Play's Device and Network Abuse policy allows non-executable content).
- [ ] **AI-generated content policy:** the app has no user-to-user sharing of AI output, but Play requires a way to report or flag offensive AI output. Add a "Report a response" action in the chat (an email intent is enough), or document why it is exempt. **code (open)**
- [ ] Internal testing track → closed testing (Play requires 12+ testers for 14 days on new personal developer accounts) → production. **you**
- [ ] Real-device pass of the release build: cold start, upload, scan, OCR, lock, AI download → kill the app → relaunch shows **downloaded** and auto-loads in chat, delete, dark mode + Hindi, hardware back. **device**

## Apple App Store

- [ ] Apple Developer Program account, bundle id, App Store Connect record. **you**
- [ ] Xcode installed, `pnpm --filter kagaz build && pnpm exec cap sync ios`, then archive. **Not done 2026-11-18: no Xcode on the build machine.** **you**
- [x] `PrivacyInfo.xcprivacy` in the App target ✅ code ([app-store-privacy.md](app-store-privacy.md)).
- [x] Usage strings: camera, photo library (read + add), microphone, speech recognition, Face ID ✅ code.
- [x] `UIRequiredDeviceCapabilities` = `arm64` (was `armv7`) ✅ code.
- [ ] Export-compliance answer confirmed with counsel (SQLCipher on-device encryption).
- [ ] App Privacy questionnaire per [app-store-privacy.md](app-store-privacy.md). **you**
- [ ] iOS verification of every native plugin on a real iPhone. The scanner (`@capacitor-mlkit/document-scanner`) and the custom ML Kit OCR plugin are Android-focused: confirm their iOS behaviour or hide those entry points on iOS like the AI section. **device**
- [ ] Sign in with Apple is **not** required (no account system in V1).
- [ ] TestFlight build → review. **you**

## Build commands

```bash
pnpm lint && pnpm type-check && pnpm --filter kagaz test && pnpm agent:lint   # gates
pnpm --filter kagaz build                                                      # release web bundle (demo code compiled out)
pnpm --filter kagaz cap:sync                                                   # copy into android/ + ios/
cd apps/kagaz/android && ./gradlew bundleRelease                               # Play AAB (needs signingConfig)
# iOS: open apps/kagaz/ios/App/App.xcworkspace in Xcode → Product → Archive
```

## Known gaps found on 2026-11-18

1. **Voice input is not guaranteed offline.** `@capacitor-community/speech-recognition` has no on-device-only flag, so Google or Apple may process the audio on their servers. This is disclosed in the privacy policy draft and in the store forms. The fix is [AI-X8](../roadmap/future-extensions.md#ai-x8--fully-offline-voice-input).
2. **The privacy policy draft predates V1.5.** It now has an on-device-AI section (2026-11-18). Counsel must review it before publishing.
3. **No release signing config or version wiring** in `android/app/build.gradle`.
4. **Play AI-content reporting** is not built (see Google Play above).
5. **iOS has never been built** from this repo state.
