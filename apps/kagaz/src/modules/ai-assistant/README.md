# ai-assistant (V1 · Lane D)

On-device AI chatbot (LiteRT-LM, forked native tool-calling bridge) with tool calling, voice I/O, screen navigation. Items F-13–15, F-23.

**Engines:** `useChat` talks to a `ChatEngine` (`services/chat-engine.ts`). LiteRT-LM is the shipped default; a local Ollama server (Gemma 4 E2B) is used instead only in demo builds with `VITE_OLLAMA_URL` set — see [ADR-022](../../../../../docs/architecture/08-tech-stack-decisions.md#adr-022-demo-engine--local-ollama-gemma-4-behind-a-chatengine-seam) and `.env.example`. **Live model tests:** `OLLAMA_LIVE=1 pnpm --filter kagaz exec vitest run src/infrastructure/ollama`.

- Spec: [05-ai-assistant-module.md](../../../../../docs/architecture/05-ai-assistant-module.md)
- Structure: `services/` (`ai-engine.service.ts` LiteRT engine, `ai-tool-registry.ts` the ActionRegistry instance, STT/TTS), `ai-tools.actions.ts` (F-14 tool actions), `ai-document-ops.actions.ts` (PDF ops), `ai-image-ops.actions.ts` (resize / enhance / OCR), `hooks/` (`useChat`, `useVoiceInput`), `pages/`
- `[SEC]` (10-security-architecture.md §5, non-negotiable): metadata-only data boundary — document *content* never enters prompts; user confirmation required for destructive tool calls; model checksum verified; locked documents are refused by every id-taking tool.
- Navigation via the Action Registry ([agent-interface.md](../../../../../docs/design-system/agent-interface.md)), never DOM hacks.
- Starts in Wave 1 against mocked interfaces of vault/pdf/image (see [parallel-development.md](../../../../../docs/guides/parallel-development.md)).
