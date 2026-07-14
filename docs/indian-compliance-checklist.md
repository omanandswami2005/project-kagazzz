# Indian Regulatory & Compliance Checklist — Kagaz (Omni Docs)

> Purpose: A single, living reference for legal, privacy, security, and government-integration requirements relevant to an app that stores and processes citizens' government documents (locally on-device) and integrates with DigiLocker and Common Service Centres (CSCs).
>
> Last updated: 2026-06-08

---

## Executive summary

Kagaz handles sensitive personal data (IDs, government documents, OCR text, Aadhaar-related data). Compliance spans multiple domains:

- Indian statutory law (Aadhaar Act, IT Act)
- New data protection regime (Digital Personal Data Protection Act, 2023 — DPDP)
- Sectoral rules (UIDAI guidelines for Aadhaar; DigiLocker operational procedures)
- Platform/crypto rules (CCA / eSign)
- Cybersecurity and incident reporting (CERT-In)
- CSC / NeGD onboarding rules for government service integrations

This document summarizes required approvals, mandatory policy language, technical controls, and an actionable "must-do" checklist before any public launch or DigiLocker/CSC integration.

---

## 1) Key laws & authorities (high level)

- Information Technology Act, 2000 (IT Act) and subordinate rules (IT Rules 2011) — sets baseline cyber/infosec and privacy obligations (sensitive personal data rules historically under Rule set).
- Digital Personal Data Protection Act, 2023 (DPDP Act) — primary data protection statute; obligations on consent, purpose limitation, breach notifications, data subject rights, and fiduciary duties.
- Aadhaar (Targeted Delivery of Financial and Other Subsidies, Benefits and Services) Act, 2016 and UIDAI regulations — strict rules on use, storage, and authentication with Aadhaar. Avoid storing Aadhaar/biometric unless explicitly permitted.
- Controller of Certifying Authorities (CCA) / MeitY — governs electronic signatures, eSign providers, and certifying authorities.
- National e-Governance Division (NeGD) / DigiLocker program (MeitY) — DigiLocker partner onboarding, API usage rules, and audit/operational procedures.
- CSC SPV (Common Service Centers Special Purpose Vehicle) — controls CSC ecosystem integration and partner rules.
- CERT-In (Indian Computer Emergency Response Team) — cybersecurity incident reporting and coordination.

---

## 2) Integration-specific approvals & processes

### DigiLocker

- Empanelment / Partner Onboarding: You must apply to DigiLocker / NeGD to become a partner and gain API credentials. The onboarding requires submission of technical docs, privacy/security measures, and likely a demo/sandbox integration.
- Data usage: DigiLocker docs typically require that retrieved documents be used only with explicit user consent and not retained beyond the purpose stated without explicit permission. Check the DigiLocker partner docs for retention & audit rules.
- Fees: DigiLocker onboarding is often free for public-interest projects; commercial use / SLA tiers may have negotiated terms. Expect legal agreements (MoU / API agreement) with standard indemnities and audit rights.
- Links / start points: DigiLocker partners page and developer docs (official portal).

### CSC (Common Service Centres)

- Partnering with CSC SPV / State Nodal Agencies: If you intend to integrate services routed through CSCs or onboard CSCs (e.g., to surface CSCs in the app, enable CSC-assisted workflows, or list CSC pricing), engage CSC SPV and relevant state nodal offices.
- MoUs and training: CSC integration often requires MoUs, operational SOPs, and CSC operator training. Fees/commissions for transactions may be part of any partnership.
- Data sharing: Any sharing of user docs or personal data with CSCs requires explicit, purpose-specific consent and must be disclosed in your privacy policy.

### eSign / Digital Signatures

- Use licensed eSign providers / Certifying Authorities (CCA-regulated). Do not implement your own PKI without CCA approval.
- Each eSign operation must capture explicit user consent & an audit trail (time-stamp, IP/UA, transaction id).
- If you use Aadhaar eSign (OTP/biometric-based), check UIDAI and CCA requirements and do NOT store biometrics.

---

## 3) Primary obligations under DPDP Act & privacy best practices

- Legal Basis & Consent: Obtain explicit, informed, granular, and revocable consent for each distinct purpose (e.g., "store document in vault", "fetch from DigiLocker", "share with CSC"). Consent must be recorded and revocable from user account settings.

- Minimal Collection: Only request data strictly necessary for the declared purpose (avoid storing Aadhaar numbers unless required and permitted).

- Purpose Limitation: Use data only for the declared purposes. If you intend to use documents for analytics / model training, require an opt-in separate from core product consent.

- Data Subject Rights: Provide interfaces for access, correction, deletion (subject to legal retention obligations), portability, and right to withdraw consent.

- Retention & Deletion: Publish retention periods (documented in Privacy Policy). Implement deletion flows and deletion logs. Retain minimum logs for security/audit for a defined short period.

- Privacy Policy: Single page summary + detailed policy. Must include: data categories, purposes, legal basis, retention period, third-party sharing (DigiLocker/CSCs), security measures, grievance redressal officer contact, and a clear cookie / local-storage description.

- Children & Minors: Special rules if users under 18 — parental consent where applicable.

---

## 4) Aadhaar-specific constraints (UIDAI)

- Avoid storing Aadhaar numbers (UID) or biometric data on-device unless explicitly authorized by UIDAI and for limited lawful purposes.

- If your app uses Aadhaar authentication flows, follow UIDAI authentication APIs, collect consent per UIDAI wording, and ensure you follow UIDAI's data handling and storage instructions.

- Any use of Aadhaar-related data must comply with the Aadhaar Act (see Section 29 and others) and UIDAI technical/operational guidelines.

---

## 5) Data localization & hosting

- For government system integrations (DigiLocker, CSC), you should host servers and backups in India and ensure any cloud providers used have data residency within India for the relevant systems.

- On-device storage (the vault) is allowed but if you backup encrypted data to a cloud for sync, prefer India-only regions and document key management and encryption (keys must be under your control; consider keeping keys only on-device).

---

## 6) Security & audits (technical must-haves)

- Secure storage: AES-256 or equivalent for local file encryption; per-file keys derived from user credentials or biometric-protected key stores.
- Key management: Avoid storing unencrypted keys server-side. Prefer device keystore / Secure Enclave and end-to-end encrypted sync if implemented.
- Transport security: TLS 1.2+ with certificate pinning for critical endpoints.
- Vulnerability management: Regular SAST/DAST scans, dependency checks, and mobile app hardening (obfuscation where reasonable).
- Penetration test & security audit: Use CERT-In / MeitY empanelled auditors if required by partner agreements (DigiLocker/CSC/State agencies often demand audits).
- Logging & audit trail: Record access logs, consent timestamps, API usage with minimum retention for audit (store hashed/aggregated where possible).
- Incident response: Formal IR plan and capability to notify CERT-In (and affected users) as required.

---

## 7) Breach notification & CERT-In

- Under Indian cyber security directions and DPDP obligations, you must have a breach-reporting process. Maintain an incident response plan and a designated officer.
- CERT-In publishes reporting procedures. Government advisories may require prompt reporting; incorporate this into your SOPs.

---

## 8) Privacy Policy — required elements (template checklist)

- Short summary (1–2 lines) of what the app does
- Data collected (categories) and why (purpose)
- How data is collected (camera scan, user upload, DigiLocker import)
- Use of data (storage, OCR, indexing, sharing)
- Third-party integrations (DigiLocker, CSC partner, eSign providers) and legal basis
- Retention periods per category
- User rights and how to exercise them (access, correction, deletion)
- Consent and withdrawal mechanisms
- Security measures (encryption at rest & in transit, secure key storage)
- Contact: Grievance Officer contact details (email/phone)
- Jurisdiction and governing law (India)

---

## 9) Terms & Conditions — key clauses to include

- Service description & scope
- Eligibility (age, legal capacity)
- User obligations (accurate info, not storing third-party people's data without consent)
- Prohibitions (no misuse of DigiLocker data, no illegal documents)
- Consent & rights to process data
- Liability & indemnity (limited to the extent permitted by law)
- Termination & account deletion
- Governing law & dispute resolution (India)

---

## 10) Consent language examples (must be explicit & granular)

- "I consent to Kagaz importing my documents from DigiLocker for the purpose of saving them in my local vault. I understand these documents will be stored locally and may be backed up to [company] servers in India if I enable sync. I can withdraw this consent at any time in Settings."

- "I consent to Kagaz using the uploaded document to extract text (OCR) to enable search and expiry reminders. This processing happens on-device unless I opt into cloud processing."

- For Aadhaar auth flows: Use UIDAI-prescribed wording. Do not paraphrase UIDAI consent text when Aadhaar authentication is used.

---

## 11) Must-have checklist before launch (prioritized)

Priority P0 — Do before any public release or DigiLocker/CSC integration:

- [ ] Publish Privacy Policy & Terms (English + Hindi + other target languages)
- [ ] Implement explicit consent flows and store consent records (timestamp + UA + ip if available)
- [ ] Device-level encryption for vault (AES-256) and secure key storage (Android Keystore / iOS Keychain)
- [ ] TLS + certificate pinning for backend APIs
- [ ] Security audit / pentest (engage an external auditor)
- [ ] Adopt secure eSign provider (CCA-licensed) for digital signatures
- [ ] Prepare incident response plan & designate compliance/grievance officer
- [ ] Start DigiLocker partner onboarding (apply; prepare docs)
- [ ] Start CSC outreach (state nodal / CSC SPV) if integrating CSCs

### V1-launch applicability review (gate G1-7) — 2026-07-14

The P0 list above spans the whole lifecycle. For the **V1 (offline vault)**
release, only a subset applies — V1 transmits no data, has no backend, and does
no DigiLocker/CSC/eSign:

| P0 item | Applies to V1? | V1 status |
|---|---|---|
| Publish Privacy Policy & Terms (en + hi) | ✅ Yes | **Partial** — in-app screens done (G1-5); **finalize placeholder text + publish public URL = you** (`apps/legal-site/`). |
| Explicit consent flows + consent records | ⬜ V2 | No data leaves the device in V1 → no consent events. Lands with cloud/sharing. |
| Device encryption (AES-256) + Keystore/Keychain | ✅ Yes | **Done** — SQLCipher DB + platform-keystore-only keys (G1-2 audit). |
| TLS + certificate pinning for backend APIs | ⬜ V2 | No backend in V1. |
| Security audit / pentest (external) | ➖ Advisory | V1 attack surface is on-device only; a code security review is advisable, full external pentest is a V2 (backend) must (G2-6). |
| CCA-licensed eSign provider | ⬜ V3 | No eSign in V1. |
| Incident response plan + grievance officer | ✅ Yes | **Partial** — incident-response plan exists ([10-security §9](architecture/10-security-architecture.md)); **designate + name the grievance officer = you** (also required in the privacy policy). |
| DigiLocker partner onboarding | ⬜ V3 | Not in V1. |
| CSC outreach | ⬜ V3 | Not in V1. |

**V1 gate summary:** the two *technical* P0s (encryption/key storage, incident
plan) are ✅ done; the rest are either V2/V3 or the **legal/content items you
own** (finalize + publish the policy/T&C, name the grievance officer). No V1
blocker sits in code.

Priority P1 — Important before scale / growth features (sync, cloud backups):

- [ ] Data residency validation for any cloud backups (India regions)
- [ ] Data Protection Impact Assessment (DPIA) / privacy impact assessment for sensitive flows
- [ ] Consent management dashboard & data subject request handling
- [ ] Logging & monitoring with retention policy
- [ ] Legal review of T&Cs, indemnities and local consumer laws

Priority P2 — Ongoing & growth-phase:

- [ ] Quarterly audits & compliance reviews
- [ ] Process for DigiLocker / CSC audits & report submission
- [ ] Governance for any community data (CSC ratings / process updates)

---

## 12) Model clauses & templates (starter)

### Short privacy summary (for UI)

"Kagaz keeps your documents on your device. With your permission, we can import documents from DigiLocker and let you share documents via 5-digit links. You control what we store and can delete anything anytime."

### Grievance officer template

Name: [Designated Officer]
Email: legal@omnидocs.example
Phone: +91-XXXXXXXXXX

(Replace with a real person before public launch.)

---

## 13) Notes on revenue/legal monetization with CSCs

- Any marketplace or referral payments involving CSCs must be fully disclosed to users and reflected in T&Cs. If you intend to display CSC fees, validate data with CSC SPV/state nodal agencies periodically.

---

## 14) Recommended next steps (technical & legal)

1. Engage a local Indian privacy lawyer to review this checklist and draft the final privacy policy & T&Cs specific to your business model.
2. Target DigiLocker partner onboarding: gather architecture docs, privacy policy, security audit summary, and an integration plan.
3. Finalize on-device encryption strategy and back-up (India-only) architecture.
4. Create consent UX wires for important flows (DigiLocker import, share, backup, eSign).
5. Run an external pentest and fix critical issues before submitting to DigiLocker / CSC partners.

---

## 15) References & starting points

- DigiLocker: https://digilocker.gov.in/
- DigiLocker Partners / Developers (start here): https://digilocker.gov.in/partners/
- CSC: https://www.csc.gov.in/
- Aadhaar Act (text): https://uidai.gov.in/images/the_aadhaar_act_2016.pdf
- IT Rules (2011): https://meity.gov.in/writereaddata/files/GSR313E_10511(1).pdf
- Digital Personal Data Protection Act, 2023 (summary / press release): https://pib.gov.in/PressReleasePage.aspx?PRID=1948664
- CCA / eSign guidelines: https://cca.gov.in/
- CERT-In: https://www.cert-in.org.in/

---

## 16) Appendix — Example consent & privacy UI texts (short)

- "Allow Kagaz to import documents from DigiLocker?\n[Cancel] [Allow (Import)]"
- "Allow Kagaz to OCR this document for search? OCR happens on-device by default. [Deny] [Allow]"
- "Back up encrypted vault to cloud servers located in India? This allows cross-device sync. You may revoke anytime. [No] [Yes — Enable backup]"

---

*This file is a starting point. Legal obligations evolve; always confirm with legal counsel and authoritative government sources before signing partnerships or going live.*
