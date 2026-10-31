/**
 * A tool the model may call, described as an OpenAPI-style JSON schema.
 * Threaded through to the native LiteRT-LM `OpenApiTool` bridge (Kagaz fork,
 * see docs/architecture/05-ai-assistant-module.md §3.0/§4) — the schema
 * itself is opaque to the plugin, it only forwards it to the engine.
 */
export interface ToolDescriptor {
  /** Must match the `name` the model uses when it calls this tool. */
  name: string;
  /** Full OpenAPI-style tool description (name/description/parameters), as a JSON string. */
  descriptionJson: string;
}

/**
 * Kagaz fork addition: fired when the model wants to call a tool that has no
 * native implementation — the caller must eventually call {@link LLMPlugin.resolveToolCall}
 * with the same `requestId`, or the native side times out after 30s.
 */
export interface ToolCallRequestedEvent {
  requestId: string;
  /** Matches a `name` passed in {@link ToolDescriptor}. */
  name: string;
  /** Tool call arguments, as a JSON string (parse per the tool's own schema). */
  argumentsJson: string;
}

/** Kagaz fork addition: which backend actually loaded, and how long it took. */
export interface AiCapabilities {
  backend: 'cpu' | 'gpu';
  loadTimeMs: number;
}

/**
 * LLM Plugin interface for interacting with on-device language models
 */
export interface LLMPlugin {
  /**
   * Creates a new chat session
   * @returns Promise with chat id and optional instructions
   */
  createChat(options?: { systemPrompt?: string }): Promise<{ id: string; instructions?: string }>;

  /**
   * Sends a message to the AI in a specific chat session
   * @param options - The chat id and message to send
   * @returns Promise that resolves when message is sent
   */
  sendMessage(options: { chatId: string; message: string }): Promise<void>;

  /**
   * Gets the readiness status of the LLM
   * @returns Promise with readiness status string
   */
  getReadiness(): Promise<{ readiness: string }>;

  /**
   * Sets the model configuration
   * - iOS: Use "Apple Intelligence" as path for the system model. Custom LiteRT-LM `.litertlm` models are supported on iOS only when this plugin is integrated through Swift Package Manager, and are selected only when `modelType: 'litertlm'` is passed or the path ends in `.litertlm`.
   * - Android: Use "Gemini Nano" for the AICore system model on supported devices where it is already available. Prefer LiteRT-LM `.litertlm` bundles for custom models; legacy MediaPipe `.task` models are still supported
   * - Web: Provide a web-ready model asset for `@mediapipe/tasks-genai` such as Gemma 4 `*-web.task`
   * @param options - The model configuration
   * @returns Promise that resolves when model is loaded
   */
  setModel(options: ModelOptions): Promise<void>;

  /**
   * Downloads a model from a URL and saves it to the appropriate location
   * - iOS: Downloads to the app's documents directory
   * - Android: Downloads to the app's files directory
   * @param options - The download configuration
   * @returns Promise with download result including the saved path
   */
  downloadModel(options: DownloadModelOptions): Promise<DownloadModelResult>;

  /**
   * Restricts which tools one chat may call (skills); the conversation is rebuilt with its history replayed.
   * `tools` omitted = every tool. Kagaz addition.
   */
  setToolSubset(options: { chatId: string; tools?: string[] }): Promise<void>;

  /**
   * Embeds texts with an EmbeddingGemma `.litertlm` file via the LiteRT-LM EmbeddingEngine
   * (Android, CPU). The engine is created lazily on first call. Kagaz addition.
   * @returns L2-normalised vectors, one per text, in input order
   */
  embedTexts(options: EmbedTextsOptions): Promise<EmbedTextsResult>;

  /**
   * Adds a listener for text received from AI
   * @param eventName - Event name 'textFromAi'
   * @param listenerFunc - Callback function for text events
   * @returns Promise with remove function to unsubscribe
   */
  addListener(
    eventName: 'textFromAi',
    listenerFunc: (event: TextFromAiEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Adds a listener for AI completion events
   * @param eventName - Event name 'aiFinished'
   * @param listenerFunc - Callback function for finish events
   * @returns Promise with remove function to unsubscribe
   */
  addListener(
    eventName: 'aiFinished',
    listenerFunc: (event: AiFinishedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Adds a listener for generation failures that happen after streaming starts
   * @param eventName - Event name 'generationError'
   * @param listenerFunc - Callback function for generation errors
   * @returns Promise with remove function to unsubscribe
   */
  addListener(
    eventName: 'generationError',
    listenerFunc: (event: GenerationErrorEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Adds a listener for model download progress events
   * @param eventName - Event name 'downloadProgress'
   * @param listenerFunc - Callback function for progress events
   * @returns Promise with remove function to unsubscribe
   */
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (event: DownloadProgressEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Adds a listener for readiness status changes
   * @param eventName - Event name 'readinessChange'
   * @param listenerFunc - Callback function for readiness events
   * @returns Promise with remove function to unsubscribe
   */
  addListener(
    eventName: 'readinessChange',
    listenerFunc: (event: ReadinessChangeEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;

  /**
   * Get the native Capacitor plugin version.
   *
   * @returns Promise that resolves with the plugin version
   * @throws Error if getting the version fails
   * @since 1.0.0
   * @example
   * ```typescript
   * const { version } = await CapgoLLM.getPluginVersion();
   * console.log('Plugin version:', version);
   * ```
   */
  getPluginVersion(): Promise<{ version: string }>;

  /**
   * Kagaz fork addition. SHA-256 of a file already on disk (e.g. a downloaded
   * model), computed natively off the main thread. Not present upstream —
   * added because `[SEC]` requires verifying model integrity before load
   * (docs/architecture/10-security-architecture.md §5) and the plugin has no
   * built-in integrity check.
   */
  sha256File(options: { path: string }): Promise<{ hash: string }>;

  /**
   * Kagaz fork addition. Deletes a cached model file (e.g. after a checksum
   * mismatch, or the user tapping "Delete" in Settings → AI Assistant). Not
   * present upstream.
   */
  deleteModel(options: { path: string }): Promise<void>;

  /**
   * Kagaz fork addition. Resolves a pending {@link ToolCallRequestedEvent} —
   * unblocks the native background thread that's waiting on it. `resultJson`
   * is handed back to the model as the tool's return value; if the tool
   * failed, encode that as JSON too (e.g. `{"error": "..."}"`), never throw.
   */
  resolveToolCall(options: { requestId: string; resultJson: string }): Promise<void>;

  /**
   * Kagaz fork addition. Reports which backend the currently-loaded model is
   * actually running on (the native side silently falls back cpu↔gpu; the
   * Settings screen wants to show the real answer, not the requested one).
   */
  getCapabilities(): Promise<AiCapabilities>;

  /**
   * Kagaz fork addition. Fired when the model calls a tool passed via
   * {@link ModelOptions.tools} that has no native implementation.
   */
  addListener(
    eventName: 'toolCallRequested',
    listenerFunc: (event: ToolCallRequestedEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/**
 * Event data for text received from AI
 */
export interface TextFromAiEvent {
  /** The text content from AI - this is an incremental chunk, not the full text */
  text: string;
  /** The chat session ID */
  chatId: string;
  /** Whether this is a complete chunk (true) or partial streaming data (false) */
  isChunk?: boolean;
}

/**
 * Event data for AI completion
 */
export interface AiFinishedEvent {
  /** The chat session ID that finished */
  chatId: string;
}

/**
 * Event data for generation failures
 * `chatId` is optional and may be omitted when the failure is not tied to a specific chat.
 */
export interface GenerationErrorEvent {
  /** Optional. The chat session ID that failed, when available. */
  chatId?: string;
  /** Error message describing the failure */
  error: string;
}

/**
 * Options for downloading a model
 * Only `url` is required. `companionUrl` and `filename` are optional.
 */
export interface DownloadModelOptions {
  /**
   * Expected size in bytes. Used for progress when the server sends no Content-Length (Kagaz addition).
   */
  expectedBytes?: number;
  /** Echoed on this download's `downloadProgress` events so concurrent downloads can be told apart (Kagaz addition). */
  tag?: string;
  /** URL of the model file to download */
  url: string;
  /** Optional: URL of a companion file for legacy model formats */
  companionUrl?: string;
  /** Optional: Custom filename (defaults to filename from URL) */
  filename?: string;
}

/**
 * Result of model download
 */
export interface DownloadModelResult {
  /** Path where the model was saved */
  path: string;
  /** Path where the companion file was saved (if applicable) */
  companionPath?: string;
}

/**
 * Event data for download progress
 */
export interface DownloadProgressEvent {
  /** Percentage of download completed (0-100) */
  progress: number;
  /** The `tag` the download was started with, if any (Kagaz addition). */
  tag?: string;
  /** Total bytes to download */
  totalBytes?: number;
  /** Bytes downloaded so far */
  downloadedBytes?: number;
}

/**
 * Event data for readiness status changes
 */
export interface ReadinessChangeEvent {
  /** The readiness status */
  readiness: string;
}

/**
 * Model configuration options
 * Only `path` is required. All other properties are optional overrides.
 */
export interface ModelOptions {
  /** Model path, "Apple Intelligence" for the Apple system model on iOS, or "Gemini Nano" for the Android AICore system model when already available on the device. On iOS, custom `.litertlm` models require the plugin to be integrated through Swift Package Manager. Gemma 4 examples use `.litertlm` on mobile and `*-web.task` on web. */
  path: string;
  /** Optional. Model file type/extension (for example `task`, `bin`, `litertlm`, or `gemini-nano`). If not provided, it is extracted from the path. On iOS, LiteRT-LM is selected only when this resolves to `litertlm`; all other custom types keep the legacy MediaPipe compatibility path. */
  modelType?: string;
  /** Maximum number of tokens the model handles */
  maxTokens?: number;
  /** Number of tokens the model considers at each step */
  topk?: number;
  /** Amount of randomness in generation (0.0-1.0) */
  temperature?: number;
  /** Optional. Random seed for generation. */
  randomSeed?: number;
  /**
   * Optional. LiteRT-LM engine backend for iOS (SwiftPM) and Android.
   * Use `cpu` for stable long generations. When omitted, iOS prefers CPU then falls back to GPU; Android uses CPU.
   * @since 8.2.0
   */
  backend?: 'gpu' | 'cpu';
  /**
   * Kagaz fork addition. Tools the model may call — each becomes a native
   * `OpenApiTool` bridged back to {@link LLMPlugin.addListener}('toolCallRequested', ...).
   * Not present upstream. Android (LiteRT-LM backend) only; ignored elsewhere.
   */
  tools?: ToolDescriptor[];
}

/** Options for {@link LLMPlugin.embedTexts}. */
export interface EmbedTextsOptions {
  /** Absolute path of the EmbeddingGemma `.litertlm` file. */
  path: string;
  /** Texts to embed (keep each under ~512 tokens). */
  texts: string[];
}

/** Result of {@link LLMPlugin.embedTexts}. */
export interface EmbedTextsResult {
  embeddings: number[][];
}
