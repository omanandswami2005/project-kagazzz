# ai-assistant (V1 · Lane D)

On-device AI chatbot (LiteRT-LM, forked native tool-calling bridge) with tool calling, voice I/O, screen navigation. Items F-13–15, F-23.

- Spec: [05-ai-assistant-module.md](../../../../../docs/architecture/05-ai-assistant-module.md)
- Structure: `services/` (`ai-engine.service.ts` LiteRT engine, `ai-tool-registry.ts` the ActionRegistry instance, STT/TTS), `ai-tools.actions.ts` (F-14 tool actions), `hooks/` (`useChat`, `useVoiceInput`), `pages/`
- `[SEC]` (10-security-architecture.md §5, non-negotiable): metadata-only data boundary — document *content* never enters prompts; user confirmation required for destructive tool calls; model checksum verified.
- Navigation via the Action Registry ([agent-interface.md](../../../../../docs/design-system/agent-interface.md)), never DOM hacks.
- Starts in Wave 1 against mocked interfaces of vault/pdf/image (see [parallel-development.md](../../../../../docs/guides/parallel-development.md)).
