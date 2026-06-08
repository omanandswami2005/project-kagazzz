# Data Protection Impact Assessment (DPIA) — Kagaz (Omni Docs)

Last updated: 2026-06-08

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
