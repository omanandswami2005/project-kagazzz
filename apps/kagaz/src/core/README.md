# core/

Shared, dependency-free building blocks used by every module: `config/`, `constants/`, `hooks/`, `utils/`, `types/`, `i18n/` (P0-8).

Rules:

- Anything here may be imported by any module or layer; `core/` itself imports from no module.
- Spec: [docs/architecture/01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md) §Module Structure.
