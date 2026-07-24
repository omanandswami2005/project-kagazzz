# @kagaz/capacitor-llm-litert

Fork of [`@capgo/capacitor-llm`](https://github.com/Cap-go/capacitor-llm) v8.1.3 (MPL-2.0), vendored here rather than consumed from npm so the diff below can be maintained long-term. Full rationale: [docs/architecture/05-ai-assistant-module.md](../../docs/architecture/05-ai-assistant-module.md) §3.0.

## Why forked

Upstream's native Android layer already depends on `com.google.ai.edge.litertlm:litertlm-android`, which natively supports tool calling — but the plugin's JS bridge never threads a `tools` array through to it, so tool calling was unreachable from the app layer as shipped.

## Diff against upstream 8.1.3

- **Added**: `JsBridgeTool` (`android/.../JsBridgeTool.java`) — a native `OpenApiTool` that bridges a tool call to a JS `toolCallRequested` event and blocks a background executor thread on a `CompletableFuture` until `resolveToolCall()` answers it. See `docs/architecture/05-ai-assistant-module.md` §4.1 for the full sequence diagram.
- **Added**: `tools?: ToolDescriptor[]` on `ModelOptions`, threaded into `ConversationConfig.tools` at `createChat()` time.
- **Added**: `sha256File()`, `deleteModel()` plugin methods — upstream has no model-integrity verification or explicit delete; both are `[SEC]` §5 non-negotiables for this app.
- **Added**: `getCapabilities()` — reports the requested backend (`cpu`/`gpu`) and last load duration, for the Settings → AI Assistant screen.
- **Removed**: the Gemini Nano backend (`com.google.mlkit:genai-prompt`) — it requires `minSdkVersion 26`, incompatible with this app's API 24+ target (`CLAUDE.md`), and this app never requests it (always loads a bundled `.litertlm` model via the LiteRT backend).
- **Removed**: the web implementation's `@mediapipe/tasks-genai` usage (which fetched its WASM runtime from a CDN at call time) — this app gates the AI Assistant entry point to Android-native only (`isAiSupported()`), so the web path is unreachable; kept as a `WebPlugin` stub that throws, not deleted outright, so the TS interface still type-checks on non-native builds.
- **Kept, unused**: the legacy MediaPipe `.task` backend — upstream's own documented compatibility path. This app always requests `modelType: 'litertlm'`, so it's currently dead code for us, but it isn't a build blocker (unlike Gemini Nano) so it wasn't ripped out speculatively.

## Upgrading from upstream

When bumping to a newer upstream release: re-diff `LLM.java`/`LLMPlugin.java`/`definitions.ts`/`web.ts` against the new upstream source, re-apply the additions above, and re-run `./gradlew :kagaz-capacitor-llm-litert:compileDebugJavaWithJavac` to catch any API drift in `com.google.ai.edge.litertlm` before touching the rest of the diff.
