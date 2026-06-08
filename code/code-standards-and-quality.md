# Compliance-Focused Code Standards — Kagaz (Omni Docs)

Last updated: 2026-06-08

Purpose

This document lists only the code, security, and operational standards required to meet Indian legal/regulatory obligations and reasonable future compliance expectations (DigiLocker, UIDAI/Aadhaar, DPDP Act, IT Act, CERT‑In, CCA for eSign, CSC SPV). Keep this file minimal and audit-oriented — developer-facing style/formatting rules are documented elsewhere.

Scope & applicability

Applies to all code and operational artifacts that touch personal data, government integrations (DigiLocker, CSCs), backups, authentication, signing, and production infrastructure.

1. Legal & regulator mapping (quick)

- DPDP Act (2023): consent recording, breach notifications, data subject rights, retention limits.
- IT Act & Rules: reasonable security practices, incident reporting obligations.
- Aadhaar Act & UIDAI rules: consented use only; do NOT store Aadhaar numbers/biometrics unless UIDAI permits and a separate legal flow exists.
- DigiLocker / NeGD: partner onboarding, audit rights, retention & usage restrictions.
- CCA / eSign: use licensed certifying authorities for digital signatures.
- CERT‑In: follow directions for vulnerability and incident reporting.

2. Data handling & minimization (mandatory)

- Minimize collection: store only the data strictly necessary for declared purposes.
- Aadhaar: never store raw Aadhaar number or biometrics unless expressly permitted by UIDAI and with separate, auditable consent.
- Consent: capture explicit, purpose-specific consent for each flow (import, OCR, backup, share). Persist consent logs with: user id, timestamp (ISO 8601), action, scope, client UA, and request id.
- Retention: implement configurable retention per data category; default retention for audit/consent logs = 2 years unless law requires longer. Clearly document retention periods in Privacy Policy.
- Deletion: honoring user deletion requests must purge user-accessible copies within 30 days and purge backup copies per retention policy; keep immutable audit records (consent, event logs) for the documented retention window.

3. Data residency & backups (mandatory for govt integrations)

- Any server-side backups, logs, or metadata for DigiLocker/CSC integrations must reside in India region(s) only.
- On-device storage is primary; cloud backups are opt-in only and must be encrypted (see Encryption section).
- If cross-device sync is provided, enforce India-only hosting and document key management.

4. Encryption & key management (mandatory)

- Transport: TLS 1.2+ (prefer TLS 1.3) for all network traffic. Enforce HSTS and certificate pinning for critical endpoints (DigiLocker endpoints, auth, backup APIs).
- At-rest (server): AES-256 or equivalent for stored backups and audit logs containing sensitive metadata.
- On-device: encrypt files with AES-256 and protect keys with platform keystore (Android Keystore / iOS Secure Enclave).
- Backups / Sync: end-to-end encryption is required where possible. If servers broker encrypted blobs, the user must control the encryption key or a secure key-splitting mechanism must be documented.
- Key custody: do not store master encryption keys in source repos or in plaintext on CI. Use a secrets manager (GitHub Secrets, Vault) with strict ACLs.

5. Access control & developer operations (mandatory)

- Principle of least privilege for all environments (prod, staging). Require role-based access and review access quarterly.
- MFA mandatory for all developer / ops accounts with access to production or keys.
- Store signing keys (app signing, release keys) in a secure secret manager; restrict and audit access.
- All privileged actions (key retrieval, key rotation, backup restore) must be logged and require authorization.

6. Logging, audit trails & redaction (mandatory)

- Maintain immutable audit logs for: consent events, DigiLocker imports, share actions, eSign transactions, admin actions, and data exports.
- Audit logs must record: event id, user id (pseudonymized where possible), action, scope, timestamp, acting principal, request id, and outcome.
- Redact or hash highly sensitive fields (Aadhaar, PAN) in logs. Logs containing PII must be encrypted at rest and have restricted access.
- Retention for audit logs: configurable but not less than required by law/partner agreements (default 2 years) and document exceptions.

7. Incident response & breach notification (mandatory)

- Maintain an Incident Response Plan (IRP) that covers detection, containment, eradication, and recovery.
- Report breaches as required by DPDP/IT rules and any specific partner (DigiLocker/CSC) agreements. Prepare templates for regulator and user notifications.
- Follow CERT‑In reporting guidance and timelines applicable at the time of the incident; record and retain breach investigation artifacts.

8. Security testing, audits & third-party assessments (mandatory)

- Pre-production: perform SAST and dependency vulnerability scans on every PR. Fail the build on critical severity findings.
- Penetration testing: external pentest at least annually and after any major security change; remediate critical/High findings before production use for government integrations.
- Third-party vendor assessments: require SOC-2 / ISO27001 or equivalent for vendors handling backups, signing, or PII.
- Supply-chain: generate SBOM (Software Bill of Materials) for production builds and maintain dependency lockfiles.

9. Code & release controls required by regulators

- Protected branches: require passing CI (lint, typecheck, security scan, unit tests) and at least one security/engineering approval before merge to main.
- Reproducible builds: produce reproducible artifacts and store signed build artifacts for audit. Keep signed APKs/IPAs and release metadata in an auditable artifact repository.
- Code provenance: enable CodeQL or comparable static analysis and retain results with commits for auditability.

10. eSign / digital signature rules (mandatory)

- Use only CCA-approved eSign providers for any signature flows.
- Capture explicit user consent and record eSign transaction metadata: signer id, method (OTP/biometric), timestamp, signing certificate id, and transaction id.
- Do NOT store biometric data. Store only auditable signature proof artifacts as required by the eSign provider and law.

11. DigiLocker & CSC integration controls (mandatory)

- Follow DigiLocker partner onboarding requirements: attach privacy policy, security docs, and pen test report.
- Enforce OAuth flows for DigiLocker imports; store only what user consented to and log the import event.
- For CSC-assisted flows, ensure MoU and operator training exist; implement UI consent and point-of-transaction fee transparency.
- Provide APIs/logs to partners or auditors on request subject to legal process and MoU terms.

12. Privacy & DPIA artifacts (mandatory)

- Maintain up-to-date DPIA documents for features that process sensitive data (DigiLocker import, OCR extraction, backups, eSign). Keep DPIA versioned and available for audits.
- Publish and keep current: Privacy Policy, Data Retention Policy, Consent Capture UX, and Grievance Redressal contact.

13. Supply chain & dependency policies (mandatory)

- Pin dependency versions and commit lockfiles to repository; run automated dependency updates via Dependabot/Renovate with mandatory CI verification.
- Block known-malicious packages and high-severity vulnerabilities in CI; require approved mitigation before merge when medium severity issues are present.
- Maintain SBOM for each release and make it available to government auditors upon request.

14. Records & documentary requirements (mandatory)

- Keep: Privacy Policy, T&Cs, DPIAs, pen test reports, audit logs, consent logs, vendor contracts (eSign, backup), and DigiLocker/CSC MoUs for the retention period required by law and partner agreements.
- Provide a documented process to produce these records for audits within the timelines agreed with auditors or regulators.

15. Change control & emergency procedures (mandatory)

- Changes to production code that affect data handling must go through documented change control (ticket, code review, test plan, rollback plan).
- Emergency (hotfix) process must include post-facto review, additional testing, and documentation for auditors.

16. Organizational controls (mandatory)

- Designate a Data Protection Officer / Grievance Officer and document contact details in Privacy Policy and internal records.
- Maintain role-based separation of duties for developers, reviewers, and release engineers with quarterly access reviews.

References & links

- DigiLocker: https://digilocker.gov.in/
- UIDAI / Aadhaar Act: https://uidai.gov.in/
- Digital Personal Data Protection Act, 2023: government publications
- CERT‑In: https://www.cert-in.org.in/
- Controller of Certifying Authorities (CCA): https://cca.gov.in/

---

This file focuses on compliance-required engineering and operational rules. Keep it up to date for audits and attach evidence (reports, logs, MoUs) under `docs/compliance/` or the secure audit repository as required.