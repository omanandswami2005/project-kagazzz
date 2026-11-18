# Apple App Store — App Privacy declaration (Kagaz V1)

> **App Store Privacy** · Last Updated: 2026-11-18 · Scope: **V1 on iOS**. On-device AI is Android-only in V1 (see [AI-X4](../roadmap/future-extensions.md#ai-x4--on-device-ai-on-ios)).

This maps what Kagaz actually does on iOS to App Store Connect's **App Privacy** questions (the "nutrition label") and to the bundled privacy manifest. It must stay consistent with [play-data-safety.md](play-data-safety.md) and [the privacy policy](../legal/privacy-policy.md).

## Table of Contents

- [Ground truth](#ground-truth)
- [App Store Connect answers](#app-store-connect-answers)
- [Privacy manifest](#privacy-manifest)
- [Permission usage strings](#permission-usage-strings)
- [Review notes](#review-notes)
- [Open items before submission](#open-items-before-submission)

## Ground truth

- No account, no analytics, no crash reporting, no ads, no tracking. Documents, OCR text and the database stay on the device: SQLCipher, with the key in the iOS Keychain ([10-security §3](../architecture/10-security-architecture.md)).
- On iOS V1 the app makes **no app-initiated network requests**. The AI model download exists only on Android (`isAiSupported()`).
- **Voice input** uses Apple's Speech framework (`SFSpeechRecognizer`). Apple may process the audio on its servers under Apple's own privacy terms. Kagaz does not receive, store or send the audio; it only gets the transcript, which goes into the chat box. Apple counts data that the developer or its third-party partners collect; audio handled by Apple's own system service is not collected by Kagaz. Still, say this plainly in the privacy policy (done) and keep it in mind: if review disagrees, declare "Audio Data — App Functionality, not linked, not tracking".

## App Store Connect answers

| Question | Answer |
|---|---|
| Do you or your third-party partners collect data from this app? | **No, we do not collect data from this app** |
| Tracking (ATT) | **No tracking.** `NSPrivacyTracking = false`; no ATT prompt |
| Privacy Policy URL | The published policy from `apps/legal-site/` (G1-5) |
| Encryption export compliance | Uses standard encryption (SQLCipher / AES) only to protect the user's own data on the device. Answer per Apple's current export-compliance questions **after legal review**. Do **not** add `ITSAppUsesNonExemptEncryption` to `Info.plist` until that answer is confirmed |

## Privacy manifest

`apps/kagaz/ios/App/App/PrivacyInfo.xcprivacy` is added to the App target's Resources (2026-11-18):

| Key | Value | Why |
|---|---|---|
| `NSPrivacyTracking` | `false` | No tracking |
| `NSPrivacyTrackingDomains` | empty | No tracking domains |
| `NSPrivacyCollectedDataTypes` | empty | Nothing collected off-device |
| UserDefaults | `CA92.1` | `@capacitor/preferences`, app-only settings |
| File timestamp | `C617.1` | `@capacitor/filesystem` `stat` of files inside the app container |
| Disk space | `E174.1` | Storage screen and checks before large writes |

The Capacitor and plugin frameworks ship their own manifests. Re-check this table whenever a native plugin is added. Then generate the privacy report in Xcode (Product → Archive → Generate Privacy Report) and confirm it matches this page.

## Permission usage strings

All are in `Info.plist` (2026-11-18). Apple rejects an app that calls one of these APIs without the string.

| Key | Used by |
|---|---|
| `NSCameraUsageDescription` | `@capacitor/camera` photo capture |
| `NSPhotoLibraryUsageDescription` | Picking photos to import |
| `NSPhotoLibraryAddUsageDescription` | Saving an export to Photos (only on request) |
| `NSMicrophoneUsageDescription` | Voice input (mic button) |
| `NSSpeechRecognitionUsageDescription` | Voice input transcription |
| `NSFaceIDUsageDescription` | App lock and per-document lock (`@aparajita/capacitor-biometric-auth`) |

## Review notes

> Kagaz is an offline document vault. All documents and text stay on the device in an encrypted database; there is no account, no server, no analytics and no tracking. Voice input uses Apple's Speech framework only while the mic button is active. The AI assistant is not available on iOS in this version.

## Open items before submission

- [ ] Build, archive and run on a real iPhone. Not possible from the 2026-11-18 session: no Xcode on the build machine.
- [ ] Generate the Xcode privacy report and diff it with this page.
- [ ] Confirm the export-compliance answer with counsel.
- [ ] App Store screenshots, age rating questionnaire, support URL, and the published privacy policy URL (G1-5).
- [ ] Hide or explain AI entry points on iOS, so review does not see a dead feature. Today they show "not available on this platform" (Guideline 2.1 completeness).
