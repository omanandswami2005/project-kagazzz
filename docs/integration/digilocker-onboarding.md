# DigiLocker Partner Onboarding Packet — Kagaz (Omni Docs)

Last updated: 2026-06-08

Purpose

This document is the recommended packet to submit when applying to become a DigiLocker partner (NeGD, MeitY). It maps Kagaz-specific details to the typical DigiLocker onboarding requirements.

1. Organizational & legal info

- Company name & registration number
- GSTIN
- Authorized contact person (name, email, phone)
- Legal entity documents (incorporation certificate, MOA/AOA)

2. Product overview

- Short product description (what Kagaz does)
- Target users & geographies
- V1 scope (on-device vault, DigiLocker import, local OCR, optional India-only backups)

3. Technical architecture

- High-level diagram (textual):
  - Mobile app (Android/iOS) — vault (on-device) — optional backup API (India-hosted) — DigiLocker OAuth redirect endpoints — audit logs DB (India)
- API endpoints and security (TLS, cert pinning)
- Data flow for DigiLocker import (OAuth, retrieval, storage)

4. Security & privacy artifacts

- Privacy Policy URL
- Security architecture doc
- Encryption at rest & key management description
- Penetration test report (if available) or planned date
- SAST/DAST summary
- Incident response plan

5. Compliance & legal

- Aadhaar usage statement (we do not store Aadhaar numbers/biometrics unless UIDAI permits)
- Data residency statement (India-only for backups & logs)
- Consent screens samples and text (attached)

6. Test plan & sandbox

- Sandbox credentials request
- Test cases: OAuth flows, document import, consent revocation, error cases

7. Operational SLAs & support

- Support contact and escalation matrix
- Expected API rate limits

8. Audit & reporting

- Agree to periodic audits and provide logs for NeGD on request

9. Contracts & MoU requests

- Request sample DigiLocker API agreement for review

Typical timelines & fees

- Initial review: 2–4 weeks
- Sandbox access: usually granted within review period
- Production whitelist after successful testing and legal sign-off
- Fees: Often zero for public-interest apps; commercial agreements may include negotiated fees.

Checklist (what to attach to application)

- Privacy Policy
- Security architecture doc
- Pen test / auditor report (or statement of planned test)
- Company incorporation and contact details
- UX screens for DigiLocker flows

---

Next steps

- Prepare the packet above and submit via DigiLocker partner portal: https://digilocker.gov.in/partners/
- Schedule technical onboarding with NeGD/MeitY if requested.

Legal note: DigiLocker/NeGD procedures change — confirm on the portal.
