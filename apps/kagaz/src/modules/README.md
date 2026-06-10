# modules/

Feature-first modules, one self-contained package per feature. V1: `document-vault`, `document-scanner`, `pdf-engine`, `image-engine`, `ai-assistant`, `search`, `settings`, `auth`. V2: `sharing`, `cloud-sync`. V3: `csc-services`.

Binding rules (see [01-system-architecture.md](../../../../docs/architecture/01-system-architecture.md)):

- **Protocol-based design**: modules talk through TypeScript interfaces only — never import another module's concrete implementation. Shared code lives in `core/` or `infrastructure/`.
- **Version dependency rule**: a module may depend only on same-version-or-earlier modules. V1 never imports V2/V3.
- Heavy ops (PDF, image, OCR, LLM) run in Web Workers (`?worker` imports).
- Every page ships `PageName.tsx` + `PageName.agent.ts` + `PageName.skill.md` ([page-skill-template.md](../../../../docs/design-system/page-skill-template.md)).
- Tests live in `__tests__/` folders beside the implementation.
