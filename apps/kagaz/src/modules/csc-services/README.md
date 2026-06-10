# csc-services (V3 — do not import from V1/V2 modules' code)

Government-service facilitation: catalog, guided workflows, fee transparency, tracking, payments. Items F-69–82.

- Spec: [07-csc-services-module.md](../../../../../docs/architecture/07-csc-services-module.md)
- Structure: `components/`, `services/`, `data/` (workflow JSON definitions), `pages/`
- `[LEGAL]`: Kagaz is a facilitator, never an official government service; fees verifiable against official sources; never store raw Aadhaar numbers or biometrics.
- V1/V2 builds must never load this module (version dependency rule).
