# Google Play — Data Safety declaration (Kagaz V1)

> **Launch gate G1-6** (see also **G1.5-4**) · Last updated: 2026-07-24 · Scope: **V1 (offline vault)**, with a **V1.5 addendum** below for the on-device AI model download.
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

## V1.5 addendum — the on-device AI model download (F-13, G1.5-4)

> Added 2026-07-24. Scope: **V1.5 (on-device AI chatbot)**. This is a genuine
> addition to the "no app-initiated network calls" ground truth above — unlike
> the scanner's transitive-only `INTERNET` permission, the AI model download
> **is** an app-initiated network request. It does not change the "Data
> collected: None" / "Data shared: None" answers (below), but it must be
> disclosed as a network operation.

- **What happens:** the user explicitly taps "Download" on the Settings → AI
  Assistant screen (never automatic/background). The app performs a single
  HTTPS GET to Hugging Face
  (`huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm`,
  ~2.6 GB, one host) for a **public, pre-trained model file** — LiteRT-LM's
  Gemma 4 E2B, Apache-2.0. The response is verified against a hardcoded SHA-256
  before use ([ADR-021](../architecture/08-tech-stack-decisions.md#adr-021-on-device-ai--litert-lm-supersedes-webllm),
  `[SEC]` §5).
- **No user data leaves the device for this request.** The GET carries no
  auth token, no user/device identifier, no document content, no query
  string beyond the static file path — it is indistinguishable from any
  anonymous visitor fetching a public file from Hugging Face's CDN. This is
  the *inverse* direction of "data collection" (Play's definition is data
  transmitted *from* the device); nothing about the user is sent.
- **Once downloaded, F-13/F-14 run entirely on-device** — no further network
  calls for chat, tool calling, or inference. Deleting the model (Settings →
  AI Assistant → Delete, or the Storage screen's "Manage" link) removes the
  only network-capable AI surface.
- **Console answers are unchanged** (V1.5 still collects/shares no user
  data), but the **manifest/runtime-behavior nuance changes**: V1.5 is no
  longer "zero app-initiated network calls" — it is "zero app-initiated
  network calls **except one explicit, user-triggered, checksum-verified
  model download**." Reflect this distinction in the reviewer notes if V1.5
  ships before a V2 re-declaration; do not claim "fully offline" without the
  same caveat CLAUDE.md already carries for the ML Kit scanner permission.

**Reviewer notes addendum (append to the V1 paragraph above once V1.5 ships):**

> Kagaz's optional on-device AI assistant (Settings → AI Assistant) requires a
> one-time, user-initiated download (~2.6 GB) of a public, open-weights model
> file (LiteRT-LM Gemma 4 E2B, Apache-2.0) from Hugging Face, verified by
> SHA-256 checksum before use. This is the only network request the app
> performs, and it carries no user data — no identifiers, no document
> content, no analytics. After download, the AI assistant runs fully
> on-device with no further network activity. Users can delete the model at
> any time from Settings → AI Assistant or the Storage screen.

## When this must change (V2)

V2 adds cloud backup (opt-in, E2E-encrypted), document sharing (TTL links), and
sync — at which point the app *does* transmit data (encrypted, India-hosted, with
consent). The declaration flips to "collects data" with the specific types,
purposes, and India-region processing. Tracked as **G2-7**.
