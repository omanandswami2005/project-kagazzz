# Google Play — Data Safety declaration (Kagaz V1)

> **Launch gate G1-6.** · Last updated: 2026-07-14 · Scope: **V1 (offline vault)** only.
>
> This maps Kagaz V1's *actual* data behaviour to the fields of the Play Console
> **Data safety** form. V1 collects and shares **no user data** — everything
> stays on the device. Fill the Console exactly as below. **Re-declare for V2**
> (cloud backup / sharing / sync) — that's gate **G2-7**, not this.

## Ground truth (why the answers below are what they are)

- V1 makes **no app-initiated network calls** — no HTTP clients, no analytics,
  no crash reporting, no account/auth server. Verified: strict CSP
  (`connect-src 'self'`), zero analytics deps, F-19 offline audit,
  airplane-mode device test. See [10-security §3.5](../architecture/10-security-architecture.md).
- Documents, OCR text, and diagnostics live **only** in the on-device encrypted
  SQLCipher DB / app-private storage. Nothing is uploaded → nothing is
  "collected" or "shared" in Play's sense (Play defines *collected* = transmitted
  off the device).
- **The one nuance — the scanner:** the release APK carries `INTERNET` +
  `ACCESS_NETWORK_STATE`, added *transitively* by the Play-Services **ML Kit
  document scanner** ([ADR-018](../architecture/08-tech-stack-decisions.md)). The
  app never uses them; they serve **Google Play Services'** one-time, on-device
  scanner-model download. That is Google Play Services' own processing, not data
  Kagaz collects. Disclose it as noted under "Reviewer notes" so the declaration
  matches the manifest.

## Console answers

**"Does your app collect or share any of the required user data types?"** → **No.**

That single answer completes the form for V1. If the Console still surfaces the
data-type matrix, the correct entries are:

| Console question | Answer (V1) |
|---|---|
| Data collected | **None** |
| Data shared with third parties | **None** |
| Is all data encrypted in transit? | N/A — **no data leaves the device** (in-transit doesn't apply). On-device data is encrypted at rest (SQLCipher + platform-keystore key). |
| Do you provide a way for users to request data deletion? | **Yes** — in-app *Settings → Delete all data* (full local erasure); Trash → Delete forever; 30-day auto-purge. No server data exists to request deletion of. |
| Data types (personal, financial, location, files & docs, messages, etc.) | **None collected.** Documents/PAN/Aadhaar images are stored **on-device only** and never transmitted. |
| Account creation required | **No account needed** in V1. |

## Reviewer notes (paste into the Console "Data safety" review notes)

> Kagaz V1 is a fully offline, on-device document vault. It collects and shares
> no user data — all documents, OCR text, and diagnostics remain in an encrypted
> on-device database and are never transmitted. The app declares no analytics or
> network clients. The `INTERNET` / `ACCESS_NETWORK_STATE` permissions in the
> manifest are added transitively by the Google Play Services ML Kit document
> scanner for its one-time on-device model download; the app itself performs no
> network requests. Users can erase all local data from in-app Settings.

## Store-listing prerequisites (do before submitting)

- [ ] Publish the **Privacy Policy** (public URL) — `apps/legal-site/` renders it;
      **finalize the placeholder text first** (entity, grievance officer, V1
      scope). See [G1-5](../../DEVELOPMENT-CHECKLIST.md) and the legal-site README.
- [ ] Ensure the privacy policy states the same "no data collected/shared, all
      on-device" facts as this declaration (they must match exactly).
- [ ] If the Data safety form asks about the ML Kit scanner specifically,
      reference Google Play Services' own data handling for on-device ML Kit.

## When this must change (V2)

V2 adds cloud backup (opt-in, E2E-encrypted), document sharing (TTL links), and
sync — at which point the app *does* transmit data (encrypted, India-hosted, with
consent). The declaration flips to "collects data" with the specific types,
purposes, and India-region processing. Tracked as **G2-7**.
