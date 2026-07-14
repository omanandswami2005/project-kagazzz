# Data Protection Impact Assessment (DPIA) — Kagaz (Omni Docs)

Last updated: 2026-07-14

## V1-scope review (launch gate G1-9) — 2026-07-14

> The body below is the full-lifecycle template (V1→V3). **V1 (offline vault)
> ships a deliberately narrow subset**, which materially lowers the risk
> profile. This section scopes the DPIA to what V1 actually does.

**In V1 · out of V1 (deferred to V2/V3, re-assess then):**

| Processing activity | In V1? | Notes |
|---|---|---|
| On-device document storage (images, PDFs) | ✅ | Encrypted at rest (SQLCipher; platform-keystore key). Never transmitted. |
| On-device OCR text extraction | ✅ | Bundled ML Kit; text stored only in the encrypted DB, never logged/sent. |
| Consent logging | ⬜ V2 | No consent events in V1 (no data leaves the device); DPDP consent flows land with cloud/sharing. |
| DigiLocker import | ⬜ V3 | OAuth authorization; **never store raw Aadhaar numbers/biometrics.** |
| Cloud backup to servers | ⬜ V2 | Opt-in, E2E-encrypted, **India-region hosting**. |
| Document sharing (TTL links) | ⬜ V2 | E2E, zero-knowledge server, audit log. |
| CSC-assisted flows / eSign | ⬜ V3 | MoUs, operator training, audit rights. |

**V1 residual-risk assessment.** Because V1 transmits **no data** and holds
**no server-side data**, the server-breach, third-party-misuse, and
consent-lifecycle risks in §4 below **do not apply to V1**. The remaining V1
risk is **device compromise** (lost/stolen/rooted device), mitigated by:
at-rest encryption (SQLCipher + keystore-only keys, never hardcoded/logged),
app-level + per-document biometric lock (F-16), `FLAG_SECURE` (no screenshots /
recents preview), temp-file cleanup, strict offline CSP, and full in-app data
erasure. Root/jailbreak *warning* (P2) is deferred and not a V1 gate.

**V1 decision.** V1's residual risk (device compromise only) is **acceptable**
given the mitigations above and the no-network / no-collection design. Formal
DPO sign-off (§7) is still required before store submission; the technical
posture is complete. **Re-run this DPIA in full before V2** (the deferred rows
introduce transmission, servers, consent, and third parties).

---

1. Overview

Purpose: Assess privacy & data protection risks for Kagaz features that process personal or sensitive data (DigiLocker import, OCR, backups, CSC sharing, eSign).

2. Project description

- Feature: DigiLocker import & on-device vault
- Actors: End user, Omni Docs servers (optional backups), DigiLocker, CSC partners, eSign providers
- Data types: Document images, OCR text, metadata, consent logs

3. Necessity & proportionality

- Storing documents on-device is necessary for offline-first access.
- DigiLocker import requires explicit OAuth authorization.
- Backups to cloud are optional and only with opt-in consent.

4. Risk identification

- Unauthorized access to documents if device compromised
- Unintended retention or sharing of Aadhaar or sensitive IDs
- Misuse by CSC operators or third parties
- Data breach of backup servers

5. Risk mitigation

- On-device encryption (AES-256), keystore protected keys
- Default no-cloud policy; backups opt-in and encrypted
- Explicit, granular consent for each sharing/import action
- Limited metadata retention and access logging
- Annual pentest and SCA of third-party providers
- CSC MoUs with audit rights and operator training

6. Residual risk & decision

Residual risk remains for device compromise and third-party misuse. Acceptable with mitigation measures: strong encryption, clear consent, legal agreements, and monitoring.

7. DPIA sign-off

Name: [Data Protection Officer]
Date: [date]

---

Note: This DPIA is a template. Complete with concrete test results and vendor assessments before production.
