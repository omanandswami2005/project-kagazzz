# Compliance Evidence Index & Audit Checklist — Kagaz (Omni Docs)

> Location: docs/compliance/index.md
> Last updated: 2026-06-08

Purpose

This file is the single index and evidence checklist for regulatory and partner audits (DigiLocker / NeGD, UIDAI, DPDP / Data Protection Board, CERT‑In, CCA / eSign, CSC SPV, and other government or third‑party auditors). It lists the artifacts you must collect, how to store them, retention expectations, who owns each artifact, and how to produce them for an audit.

Scope

Applies to all features and operations that touch personal data, government integrations (DigiLocker, CSCs), backups, authentication, signing, and production infrastructure.

How to use this file

- Store actual artifacts under `docs/compliance/` or in a secure audit repository (recommended for sensitive items). Use this index to point to file names or to the secure store location where artifacts are held.
- Keep this index current; add new rows when a new integration, vendor, or audit is introduced.
- Before any audit, produce an "evidence package" (ZIP or secure share) containing the requested subset of artifacts and this manifest.

Essential conventions

- Artifact filenames: use the pattern `YYYY-MM-DD_<artifact-type>_<short-name>.<ext>` (e.g., `2026-06-08_pen-test_report.pdf`).
- Access: Sensitive artifacts MUST be stored in an access-controlled location (private S3 bucket with encryption + IAM, or a secure internal file server). Do not store sensitive artifacts in the public repo unless redacted and approved by legal.
- Redaction: PII in artifacts should be redacted unless the auditor has proper legal clearance. Keep an unredacted version only in the secure audit repository.
- Hashing: Generate SHA-256 hashes for large artifacts and include the hash in this manifest for integrity verification.
- Retention: default retention period = 2 years for consent/audit logs and other evidence unless a law/partner agreement requires longer. See per-artifact retention column.

Audit evidence manifest (master table)

| # | Artifact | Purpose / Who Asks | Minimum Content | Typical Filename | Owner | Retention |
|---|---|---|---|---:|---|---:|
| 1 | Privacy Policy (published + historic versions) | DPDP / NeGD / Users | Public policy + version history | `2026-06-08_privacy-policy_v1.0.md` | Legal | Permanent (or until replaced; archive old versions 5 years)
| 2 | Terms & Conditions (published + historic) | Legal / auditors | Full text + change log | `2026-06-08_terms_v1.0.md` | Legal | Permanent (archive)
| 3 | DPIA(s) / Privacy Impact Assessments | DPDP / auditors | DPIA document, version history, sign-off | `2026-06-08_dpia_digilocker.md` | DPO | 5 years
| 4 | Penetration Test Report(s) | NeGD / DigiLocker / CERT‑In auditors | Full report, executive summary, remediation plan + verification | `2026-06-01_pentest_report.pdf` | Security | 3 years
| 5 | SAST / Static Analysis Results (CodeQL) | Security auditors | Snapshot of results per release/commit | `2026-06-05_codeql_results.json` | Security | 3 years
| 6 | DAST / Application Scans (reports) | Security auditors | Scan reports & remediation tickets | `2026-06-01_dast_report.pdf` | Security | 3 years
| 7 | Dependency & SBOM | Supply-chain auditors / NeGD | SBOM (CycloneDX/SPDX), lockfile | `2026-06-08_sbom.cdx.json` | Engineering | 3 years
| 8 | Pen-test remediation evidence (tickets) | Security auditors | Ticket IDs, patches, verification runs | `2026-06-10_pentest_remediation.csv` | Security & Eng | 3 years
| 9 | Consent logs (append-only) | DPDP / auditors | Event id, user id hash, ISO timestamp, action, scope, UA, request id, consent version | `consent_logs_YYYY-MM.csv` (encrypted) | Product / Privacy | 2 years (default)
| 10 | Audit logs (immutable) | Regulators | Import/export, admin, eSign, DigiLocker import events | `audit_logs_2026_Q2.log.gz` (encrypted) | Ops / Security | 2 years (or per law)
| 11 | DigiLocker partner onboarding packet | DigiLocker / NeGD | Organizational docs, security summary, privacy policy, test results | `2026-06-08_digilocker_packet.zip` | Partnerships / Eng | 7 years (partner terms)
| 12 | DigiLocker sandbox & production credentials (records) | NeGD / auditors | Credential issuance records, API keys metadata (do not store keys in repo) | `2026-06-08_digilocker_creds_metadata.yaml` | Eng / SecOps | 3 years
| 13 | DigiLocker import event traces | DigiLocker auditors | Event id, user id hash, retrieved doc ids, timestamp | `digilocker_imports_2026_Q2.log` | Product / Eng | 2 years
| 14 | CSC MoUs & agreements | CSC SPV / state agencies | Signed MoU, scope, fees, pilot letters | `2026-05-20_csc_mou_state_xyz.pdf` | BizDev / Legal | As per MoU (min 3–7 years)
| 15 | eSign provider contracts & certs | CCA auditors | Vendor contract, certifying authority certs, integration docs | `2026-05-15_esign_contract_vendor.pdf` | Legal / Eng | 5 years
| 16 | eSign transaction logs & artifacts | CCA / legal | Signer id hash, method, cert id, timestamp, txn id, signed artifact | `esign_txns_2026_Q2.log` (encrypted) | Product / Ops | 5 years (or as law requires)
| 17 | Key management & rotation records | Security auditors | KMS configs, key rotation events, access logs | `kms_rotation_2026.log` | Security | 5 years
| 18 | Hosting & data residency proof | NeGD / auditors | Cloud region configs, backup regions, infra diagrams | `2026-06-08_data_residency.md` | Infra / Security | 5 years
| 19 | Encryption design doc | Auditors / NeGD | Encryption at rest/in transit, E2EE design, key custody | `2026-06-08_encryption_design.md` | Security | 5 years
| 20 | Incident Response Plan & past incident reports | CERT‑In / DPDP | IRP, playbooks, past incident artifacts (redacted) | `2026-06-08_irp.md` / `2026-04-01_incident_report_redacted.pdf` | Security | 5 years
| 21 | CERT‑In / regulator notifications and correspondence | CERT‑In / DPDP board | Copies of notifications sent, timelines, follow-ups | `2026-04-02_certin_notification.pdf` | Legal / Security | 7 years
| 22 | Access control & IAM audits | Auditors | Quarterly access review export, MFA enforcement logs | `access_review_2026_Q2.csv` | Security / HR | 3 years
| 23 | Release artifacts & signed builds | Auditors | Signed APK/IPA, release metadata, build hashes | `2026-06-01_kagaz_v1.0_signed.apk` + `build_manifest.json` | Eng / Release | 3 years
| 24 | Change control tickets & hotfix logs | Auditors | Ticket ids, approvals, rollback notes | `change_control_2026_Q2.csv` | Eng / PM | 3 years
| 25 | Vendor assessments & vendor contracts | Auditors | SOC2 / ISO27001 evidence, contract copies | `vendor_vendorname_soc2.pdf` | Legal / Procurement | 5 years
| 26 | Employee & operator training records | Auditors / CSC SPV | Training attendance, curriculum for CSC operator training | `training_2026_csc_operators.csv` | HR / Ops | 3 years
| 27 | Privacy complaints & grievance records | DPDP / users | Complaint id, user id hash, timeline, resolution | `grievances_2026_Q2.csv` (redacted) | Legal / Support | 3 years
| 28 | Data deletion & export logs (DSR events) | DPDP / auditors | DSR request id, user id hash, action taken, timestamp | `dsr_events_2026_Q2.log` | Privacy / Ops | 2 years
| 29 | Test plans & functional test reports for DigiLocker/CSC flows | NeGD / Eng | Test cases, test results, sandbox evidence | `digilocker_tests_2026_Q2.zip` | Eng / QA | 3 years
| 30 | UI consent screen copies & localized text | DPDP / auditors | Screenshots, copy, privacy policy links, language versions | `consent_screens_en_hi.zip` | Product / UX | 3 years


Mandatory pre-audit checklist (do this before sharing evidence)

- [ ] Confirm requested artifacts and scope with auditor in writing.
- [ ] Produce a manifest (this file) and an index file listing included artifacts and SHA-256 hashes.
- [ ] Redact PII unless auditor has legal authority; mark redactions clearly and keep unredacted copies in secure repo.
- [ ] Ensure artifacts stored in secure location with access controls and temporary auditor access credentials.
- [ ] Provide a readme with contact persons (DPO, security lead, legal contact) and SLAs for responding to follow-up questions.
- [ ] Include a short executive summary highlighting critical controls (IRP, encryption, consent logs, pen-test status).

How to produce an evidence package (recommended)

1. Create a directory `/tmp/kagaz_audit_<YYYYMMDD>/`.
2. Export or copy required artifacts into that directory, preserving file names from the manifest.
3. For large log sets, provide sampled extracts + full logs in secure storage; include the query used to extract samples.
4. Generate SHA-256 hashes for each file and include `manifest_hashes.txt`.
5. Create a ZIP: `kagaz_evidence_<auditor>_<YYYYMMDD>.zip` and store in secure location (S3 with pre-signed URL, or secure file-share).
6. Share access to the zip or provide temporary credentials and a readme describing the package contents and contact persons.

Integrity & verification

- Provide SHA-256 hashes for each artifact and sign the manifest with a release/signing key if possible.
- For very sensitive evidence, consider creating an auditable HSM-signed manifest or timestamp with a trusted time-stamping service.

Sensitive handling & redaction guidance

- Redact raw Aadhaar numbers, biometrics, or other unique identifiers unless required and legally authorized.
- If the auditor requires unredacted copies, obtain a documented legal request and provide the files via secure channel only.
- When exporting DB logs, filter by event types relevant to the audit & avoid exporting diagnostics with secrets.

Artifact storage recommendations

- Non-sensitive artifacts (policies, DPIAs): can be stored in repo `docs/compliance/` (public only if safe).
- Sensitive artifacts (pen-test reports, logs, vendor contracts): store in a secure, encrypted audit repository (private S3 + KMS, or secure file server). Note the secure location path in the manifest instead of uploading them to the public repo.

Roles & responsibilities (owners)

- DPO (Data Protection Officer): legal/privacy artifacts, DPIA sign-off, grievance handling.
- Security Lead: pentest reports, SAST/DAST, infra/security docs, incident reports.
- Engineering / Release: signed builds, SBOMs, reproducible build artifacts.
- Partnerships / Legal: DigiLocker/CSC MoUs, vendor contracts.
- Ops / Infra: hosting configs, residency proof, backup configs.

Templates & quick artifacts

- manifest_hashes.txt — contains lines: `<sha256>  <filename>`
- evidence_readme.txt — short package description and contact details
- auditor_request_template.md — formal request/response template for evidence sharing

Auditor onboarding & access process

- Provide auditors with a read-only S3 bucket view or a pre-signed URL with 7–14 day expiry depending on sensitivity.
- Require auditors to sign an NDA if artifacts contain sensitive PII.
- Keep a short access log of auditor access times, IPs, and actions while they are in the environment.

Appendix: Quick commands

Generate SHA-256 hashes for a directory:

```bash
cd /tmp/kagaz_audit_2026-06-08
sha256sum * > manifest_hashes.txt
```

Create a zip:

```bash
zip -r kagaz_evidence_auditor_2026-06-08.zip .
```

Upload to S3 (example):

```bash
aws s3 cp kagaz_evidence_auditor_2026-06-08.zip s3://kagaz-audit-uploads/ --acl private --sse aws:kms --profile audit
```

Share pre-signed URL (7 days):

```bash
aws s3 presign s3://kagaz-audit-uploads/kagaz_evidence_auditor_2026-06-08.zip --expires-in 604800 --profile audit
```

Final notes

- Keep this index updated. Before any audit, run through the manifest and confirm each artifact exists and is current.
- When in doubt, keep evidence in the secure audit repository and provide metadata/manifest entries that point to the secure location rather than publishing sensitive files in the repo.

