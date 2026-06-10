# cloud-sync (V2 — do not import from V1 modules' code)

E2E-encrypted opt-in cloud backup, multi-device sync, conflict resolution. Items F-45, F-50, F-57, F-58.

- Spec: [10-security-architecture.md](../../../../../docs/architecture/10-security-architecture.md) §4.1 + [06-sharing-module.md](../../../../../docs/architecture/06-sharing-module.md)
- Structure: `services/`, `workers/` (sync, backup), `store/`
- `[SEC]` `[CONSENT]` `[DPIA]`: zero-knowledge server, India-region hosting only, key management documented.
- V1 builds must never load this module (version dependency rule).
