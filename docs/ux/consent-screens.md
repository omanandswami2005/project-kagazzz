# Consent UX & Screen Copy — Kagaz (Omni Docs)

Last updated: 2026-06-08

This file contains recommended consent UI patterns and exact language to use for key flows. Localize into Hindi and other target languages.

1. Principles

- Keep consent short, clear, and purpose-specific
- Provide a short one-line summary and a "Learn more" link to policy
- Record consent with timestamp and UA

2. Consent patterns

A. DigiLocker import (OAuth flow)

Short prompt:
"Import documents from DigiLocker into your Kagaz vault? Documents will be stored locally on your device. You can delete them anytime. Learn more. [Cancel] [Allow & Import]"

Consent record fields: user id, timestamp, redirect URL, scope, DigiLocker account id (if permitted by DigiLocker).

B. OCR processing

Short prompt:
"Allow Kagaz to scan this document for text so you can search it? OCR happens on your device by default. [Deny] [Allow]"

C. Backup / Sync

Short prompt:
"Back up an encrypted copy of your vault to our India-hosted servers for cross-device sync? Your files stay encrypted — you control the key. You can revoke anytime. [No] [Yes — Enable backup]"

D. Share with CSC

Short prompt:
"Share these documents with [CSC Name] so they can assist with [service]? This will share: [list]. [Cancel] [Allow and Send]"

E. eSign flow

Short prompt (CCA eSign):
"Sign this document using [eSign Provider]. By signing you confirm the contents and give consent for this signature. [Cancel] [Sign Now]"

3. Withdrawal flows

- Settings → Privacy → Connected services: Revoke DigiLocker access, disable backup, view consent logs
- Each revocation generates an audit entry

4. Consent storage & export

- Consent logs are exportable as CSV for audit and compliance

5. Accessibility

- All consent prompts must have clear text, large buttons, and be screen-reader accessible. Provide Hindi and other local languages.

---

Replace placeholder contact details and localize all copy before launch.
