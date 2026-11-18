# ai-assistant (V1 · Lane D)

On-device AI chatbot (LiteRT-LM, forked native tool-calling bridge) with tool calling, voice I/O, screen navigation. Items F-13–15, F-23.

**Engine:** `useChat` talks to a `ChatEngine` (`services/chat-engine.ts`); V1 ships only the on-device LiteRT-LM engine (Gemma 4 E2B, Android). The seam stays for future engines. Removed features (semantic search, online mode, Ollama, live harness) are listed in [future-extensions.md](../../../../../docs/roadmap/future-extensions.md).

**Model lifecycle:** `AIProvider` statuses `checking → not-downloaded | downloaded → loading → ready` (+ `downloading`, `error`, `unsupported`); `modelOnDisk` survives restarts. Download/delete live only on `AiAssistantPage` (`/ai-assistant`); `ChatPage` auto-loads a downloaded model. See 05 §3.4.1.

- Spec: [05-ai-assistant-module.md](../../../../../docs/architecture/05-ai-assistant-module.md)
- Structure: `services/` (`ai-engine.service.ts` LiteRT engine, `ai-tool-registry.ts` the ActionRegistry instance, STT/TTS), `ai-tools.actions.ts` (F-14 tool actions), `ai-document-ops.actions.ts` (PDF ops), `ai-image-ops.actions.ts` (resize / enhance / OCR), `hooks/` (`useChat`, `useVoiceInput`), `pages/`
- `[SEC]` (10-security-architecture.md §5, non-negotiable): metadata by default; extracted text of unlocked documents only via `ai.findInDocuments`/`ai.readDocumentText` and only because the engine is on-device; user confirmation required for destructive tool calls; model checksum verified before every load; locked documents are refused by every id-taking tool.
- Navigation via the Action Registry ([agent-interface.md](../../../../../docs/design-system/agent-interface.md)), never DOM hacks.
- Starts in Wave 1 against mocked interfaces of vault/pdf/image (see [parallel-development.md](../../../../../docs/guides/parallel-development.md)).
