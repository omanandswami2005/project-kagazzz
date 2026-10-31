package ee.forgr.capgo_llm;

import android.content.Context;
import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Content;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import com.google.ai.edge.litertlm.Message;
import com.google.ai.edge.litertlm.SamplerConfig;
import com.google.ai.edge.litertlm.ToolKt;
import com.google.ai.edge.litertlm.ToolProvider;
import com.google.mediapipe.tasks.genai.llminference.LlmInference;
import com.google.mediapipe.tasks.genai.llminference.LlmInference.LlmInferenceOptions;
import com.google.mediapipe.tasks.genai.llminference.LlmInferenceSession;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Kagaz fork of @capgo/capacitor-llm's native Android bridge — see
 * docs/architecture/05-ai-assistant-module.md §3.0 for the full rationale.
 *
 * Removed from upstream: the Gemini Nano backend (`com.google.mlkit:genai-prompt`)
 * required `minSdkVersion 26`, incompatible with this app's API 24+ target
 * (CLAUDE.md) — and this app never requests it anyway, always loading a
 * bundled `.litertlm` model via the LITERT backend. The legacy MediaPipe
 * `.task` backend is kept as upstream's own documented compatibility path,
 * even though this app doesn't use it either (always requests `litertlm`) —
 * unlike Gemini Nano it isn't a build blocker, so it's left alone rather
 * than ripped out speculatively.
 *
 * Added over upstream: JsBridgeTool-based tool calling (see
 * JsBridgeTool.java + buildToolProviders()/ToolCallBridge/ToolCallListener
 * below), sha256File()/getRequestedBackendName()/getLastLoadDurationMs().
 */
public class LLM {

    private enum BackendType {
        LITERT,
        MEDIAPIPE,
    }

    private static final double DEFAULT_TOP_P = 0.95d;
    private static LLM instance;

    private final Context context;
    private final Executor executor;
    private final Map<String, ChatSession> chatSessions;

    private Engine engine;
    private LlmInference llmInference;
    private boolean isReady = false;
    private String modelPath = null;
    private String modelType = null;
    private BackendType activeBackend = BackendType.LITERT;
    private String requestedBackend = "cpu"; // Kagaz fork addition, see getRequestedBackendName()
    private long lastLoadDurationMs = 0L; // Kagaz fork addition, see getLastLoadDurationMs()
    private long currentLoadId = 0L;

    private Integer maxTokens = 2048;
    private Integer topk = 40;
    private Float temperature = 0.1f;
    private Integer randomSeed = 101;

    // Kagaz fork addition — see JsBridgeTool.java for the full round-trip.
    private List<ToolSpec> tools = Collections.emptyList();
    private final Map<String, CompletableFuture<String>> pendingToolCalls;
    private volatile ToolCallListener toolCallListener;
    private final ToolCallBridge toolCallBridge;

    private LLM(Context context) {
        this.context = context;
        this.chatSessions = new ConcurrentHashMap<>();
        this.pendingToolCalls = new ConcurrentHashMap<>();
        // Field initializers run before this constructor body, so this has
        // to be assigned here instead — definite-assignment analysis treats
        // a lambda in an earlier field initializer as capturing `final`
        // fields before they're set, even though the lambda body itself
        // only runs later, on invocation.
        this.toolCallBridge = (name, argumentsJson) -> {
            String requestId = UUID.randomUUID().toString();
            CompletableFuture<String> future = new CompletableFuture<>();
            pendingToolCalls.put(requestId, future);

            ToolCallListener listener = toolCallListener;
            if (listener == null) {
                pendingToolCalls.remove(requestId);
                future.complete("{\"error\":\"No tool-call listener registered\"}");
                return future;
            }

            listener.onToolCallRequested(requestId, name, argumentsJson);
            return future;
        };
        this.executor = Executors.newSingleThreadExecutor();
    }

    public static LLM getInstance(Context context) {
        if (instance == null) {
            instance = new LLM(context);
        }
        return instance;
    }

    public void setModel(
        String path,
        String modelType,
        Integer maxTokens,
        Integer topk,
        Float temperature,
        Integer randomSeed,
        String backend,
        List<ToolSpec> tools,
        ModelLoadCallback callback
    ) {
        // Kagaz fork addition — read at createLiteRtConversation() time, not
        // part of the load-supersession request pipeline below (tools don't
        // affect which in-flight load "wins", only what a later createChat()
        // conversation gets configured with).
        this.tools = tools != null ? tools : Collections.emptyList();

        ModelLoadRequest request = nextLoadRequest(path, modelType, maxTokens, topk, temperature, randomSeed, backend);
        resetModelState();

        android.util.Log.d(
            "LLM",
            "setModel called with path: " +
                request.modelPath +
                ", modelType: " +
                request.modelType +
                ", maxTokens: " +
                request.maxTokens +
                ", topk: " +
                request.topk +
                ", temperature: " +
                request.temperature
        );
        initializeModel(request, callback);
    }

    private synchronized ModelLoadRequest nextLoadRequest(
        String path,
        String modelType,
        Integer maxTokens,
        Integer topk,
        Float temperature,
        Integer randomSeed,
        String backend
    ) {
        currentLoadId += 1;
        return new ModelLoadRequest(path, modelType, maxTokens, topk, temperature, randomSeed, backend, currentLoadId);
    }

    private synchronized boolean isCurrentLoad(long loadId) {
        return loadId == currentLoadId;
    }

    private void initializeModel(ModelLoadRequest request, ModelLoadCallback callback) {
        if (request.modelPath == null) {
            if (callback != null) {
                callback.onError("Model path not set");
            }
            return;
        }

        long loadStartedAtMs = System.currentTimeMillis(); // Kagaz fork addition, see getLastLoadDurationMs()
        executor.execute(() -> {
            try {
                if (!isCurrentLoad(request.loadId)) {
                    notifySupersededLoad(callback);
                    return;
                }

                BackendType backend = resolveBackend(request.modelPath, request.modelType);
                String actualPath = resolveModelPath(request.modelPath, backend);

                android.util.Log.d("LLM", "Resolved model path: " + actualPath + " using backend: " + backend);

                // A missing or empty file otherwise surfaces as an opaque native init failure.
                File modelOnDisk = new File(actualPath);
                if (!modelOnDisk.isFile() || modelOnDisk.length() == 0) {
                    throw new IllegalStateException("Model file is missing or empty: " + actualPath);
                }
                android.util.Log.d("LLM", "Model file size: " + modelOnDisk.length() + " bytes");

                if (backend == BackendType.LITERT) {
                    Engine loadedEngine = initializeLiteRtModel(actualPath, request);
                    if (!isCurrentLoad(request.loadId)) {
                        closeEngine(loadedEngine);
                        notifySupersededLoad(callback);
                        return;
                    }
                    applyLoadedModel(request, backend, loadedEngine, null);
                } else {
                    LlmInference loadedInference = initializeMediaPipeModel(actualPath, request);
                    if (!isCurrentLoad(request.loadId)) {
                        closeLlmInference(loadedInference);
                        notifySupersededLoad(callback);
                        return;
                    }
                    applyLoadedModel(request, backend, null, loadedInference);
                }

                lastLoadDurationMs = System.currentTimeMillis() - loadStartedAtMs;
                if (callback != null) {
                    callback.onSuccess();
                }
            } catch (Exception exception) {
                if (!isCurrentLoad(request.loadId)) {
                    notifySupersededLoad(callback);
                    return;
                }

                android.util.Log.e("LLM", "Failed to initialize model", exception);
                resetModelState();

                if (callback != null) {
                    callback.onError(describeFailure(exception));
                }
            }
        });
    }

    /**
     * "null" or a bare native message is useless in a bug report. Include the exception type and the root
     * cause (native init failures usually carry the real reason one level down).
     */
    static String describeFailure(Throwable error) {
        StringBuilder out = new StringBuilder(error.getClass().getSimpleName());
        if (error.getMessage() != null) {
            out.append(": ").append(error.getMessage());
        }
        Throwable root = error;
        while (root.getCause() != null && root.getCause() != root) {
            root = root.getCause();
        }
        if (root != error) {
            out.append(" (caused by ").append(root.getClass().getSimpleName());
            if (root.getMessage() != null) {
                out.append(": ").append(root.getMessage());
            }
            out.append(")");
        }
        return out.toString();
    }

    private void notifySupersededLoad(ModelLoadCallback callback) {
        if (callback != null) {
            callback.onError("Model load was superseded by a newer request");
        }
    }

    private synchronized void applyLoadedModel(
        ModelLoadRequest request,
        BackendType backend,
        Engine loadedEngine,
        LlmInference loadedInference
    ) {
        modelPath = request.modelPath;
        modelType = request.modelType;
        maxTokens = request.maxTokens;
        topk = request.topk;
        temperature = request.temperature;
        randomSeed = request.randomSeed;
        activeBackend = backend;
        requestedBackend = request.backend != null && "gpu".equalsIgnoreCase(request.backend.trim()) ? "gpu" : "cpu";
        engine = loadedEngine;
        llmInference = loadedInference;
        isReady = true;
    }

    private Engine initializeLiteRtModel(String actualPath, ModelLoadRequest request) {
        Backend primaryBackend = resolveLiteRtBackend(request.backend);
        // Kagaz fix: vision and audio backends used to be set to the primary backend. This app's chat is
        // text-only; asking the engine for Gemma 4's vision/audio sub-models too (on CPU) can make
        // initialization fail, and wastes memory when it does not. Gallery and the LiteRT-LM docs leave
        // them unset for text-only use (they are optional).
        // (modelPath, backend, visionBackend, audioBackend, maxNumTokens, maxNumImages, cacheDir)
        EngineConfig config = new EngineConfig(
            actualPath,
            primaryBackend,
            null,
            null,
            request.maxTokens,
            null,
            context.getCacheDir().getAbsolutePath()
        );
        Engine loadedEngine = new Engine(config);
        loadedEngine.initialize();
        return loadedEngine;
    }

    private Backend resolveLiteRtBackend(String backend) {
        if (backend != null && "gpu".equalsIgnoreCase(backend.trim())) {
            return new Backend.GPU();
        }

        return new Backend.CPU();
    }

    private LlmInference initializeMediaPipeModel(String actualPath, ModelLoadRequest request) {
        LlmInferenceOptions options = LlmInferenceOptions.builder()
            .setModelPath(actualPath)
            .setMaxTokens(request.maxTokens)
            .setMaxTopK(request.topk)
            .build();
        return LlmInference.createFromOptions(context, options);
    }

    private BackendType resolveBackend(String path, String modelType) {
        return "litertlm".equals(normalizeModelType(path, modelType)) ? BackendType.LITERT : BackendType.MEDIAPIPE;
    }

    private String normalizeModelType(String path, String modelType) {
        if (modelType != null && !modelType.isBlank()) {
            return stripUrlSuffix(modelType).toLowerCase();
        }

        String normalizedPath = stripUrlSuffix(path);
        int extensionIndex = normalizedPath.lastIndexOf('.');
        if (extensionIndex == -1 || extensionIndex == normalizedPath.length() - 1) {
            return "";
        }

        return normalizedPath.substring(extensionIndex + 1).toLowerCase();
    }

    private String stripUrlSuffix(String value) {
        int cutoff = value.length();
        int queryIndex = value.indexOf('?');
        int fragmentIndex = value.indexOf('#');

        if (queryIndex >= 0 && queryIndex < cutoff) {
            cutoff = queryIndex;
        }
        if (fragmentIndex >= 0 && fragmentIndex < cutoff) {
            cutoff = fragmentIndex;
        }

        return value.substring(0, cutoff);
    }

    private String resolveModelPath(String path, BackendType backendType) throws Exception {
        if (!path.startsWith("/android_asset/")) {
            return path;
        }

        String assetPath = path.substring("/android_asset/".length());
        File cacheDir = context.getCacheDir();
        File modelFile = new File(cacheDir, assetPath);

        copyAssetToFile(assetPath, modelFile);

        if (backendType == BackendType.MEDIAPIPE && assetPath.endsWith(".task")) {
            String companionPath = assetPath.replace(".task", ".litertlm");
            try {
                copyAssetToFile(companionPath, new File(cacheDir, companionPath));
            } catch (Exception exception) {
                android.util.Log.d("LLM", "No MediaPipe companion file found for " + assetPath);
            }
        }

        return modelFile.getAbsolutePath();
    }

    private void copyAssetToFile(String assetPath, File destination) throws Exception {
        File parent = destination.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        try (
            InputStream inputStream = context.getAssets().open(assetPath);
            FileOutputStream outputStream = new FileOutputStream(destination)
        ) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = inputStream.read(buffer)) > 0) {
                outputStream.write(buffer, 0, length);
            }
        }
    }

    public synchronized String createChat(String systemPrompt) {
        if (!isReady) {
            throw new IllegalStateException("Model not ready");
        }

        String chatId = UUID.randomUUID().toString();
        ChatSession session;

        if (activeBackend == BackendType.LITERT) {
            if (engine == null) {
                throw new IllegalStateException("LiteRT-LM engine not initialized");
            }
            session = ChatSession.forLiteRt(createLiteRtConversation(systemPrompt));
        } else {
            if (llmInference == null) {
                throw new IllegalStateException("MediaPipe model not initialized");
            }
            session = ChatSession.forMediaPipe();
        }

        chatSessions.put(chatId, session);
        return chatId;
    }

    private Conversation createLiteRtConversation(String systemPrompt) {
        ConversationConfig defaults = new ConversationConfig();
        SamplerConfig samplerConfig = new SamplerConfig(topk, DEFAULT_TOP_P, temperature.doubleValue(), randomSeed);
        // LiteRT-LM 0.19 added fields to ConversationConfig; copy() takes all of them, so everything
        // we do not customize is passed through from the defaults.
        ConversationConfig config = defaults.copy(
            systemPrompt != null && !systemPrompt.trim().isEmpty()
                ? com.google.ai.edge.litertlm.Contents.Companion.of(systemPrompt)
                : defaults.getSystemInstruction(),
            defaults.getInitialMessages(),
            buildToolProviders(),
            samplerConfig,
            defaults.getAutomaticToolCalling(), // true by default — see JsBridgeTool.java's doc comment
            defaults.getChannels(),
            defaults.getExtraContext(),
            defaults.getLoraConfig(),
            defaults.getPrefillPrefaceOnInit(),
            defaults.getMaxOutputToken(),
            defaults.getThinkingConfig(),
            defaults.getEnableResponseFormat(),
            defaults.getEnableSpeculativeDecoding(),
            defaults.getChatTemplate(),
            defaults.getSpeculativeDecodingConfig()
        );
        return engine.createConversation(config);
    }

    // Kagaz fork addition. One JsBridgeTool (native OpenApiTool) per
    // ToolSpec passed to setModel() — each wraps the shared
    // ToolCallBridge, which is what actually notifies JS and awaits a
    // resolveToolCall().
    private List<ToolProvider> buildToolProviders() {
        List<ToolProvider> providers = new ArrayList<>(tools.size());
        for (ToolSpec spec : tools) {
            JsBridgeTool bridgeTool = new JsBridgeTool(spec.name, spec.descriptionJson, toolCallBridge);
            providers.add(ToolKt.tool(bridgeTool));
        }
        return providers;
    }

    /** Kagaz fork addition. Registered once by LLMPlugin at load(). */
    public void setToolCallListener(ToolCallListener listener) {
        this.toolCallListener = listener;
    }

    /**
     * Kagaz fork addition. Called from LLMPlugin's resolveToolCall plugin
     * method. Returns false if requestId is unknown (already resolved, timed
     * out, or never existed) — the caller should treat that as a no-op, not
     * an error, since a late JS response after a 30s native timeout is a
     * benign race, not a bug.
     */
    public boolean resolveToolCall(String requestId, String resultJson) {
        CompletableFuture<String> future = pendingToolCalls.remove(requestId);
        if (future == null) {
            return false;
        }
        future.complete(resultJson);
        return true;
    }

    /** Kagaz fork addition. name/descriptionJson pair passed from JS via ModelOptions.tools. */
    public static class ToolSpec {

        public final String name;
        public final String descriptionJson;

        public ToolSpec(String name, String descriptionJson) {
            this.name = name;
            this.descriptionJson = descriptionJson;
        }
    }

    /**
     * Kagaz fork addition. Bridges a native tool execute() call to a pending
     * JS round-trip. Package-private (not private) — JsBridgeTool.java, a
     * separate top-level class in this package, holds a reference to it.
     */
    interface ToolCallBridge {
        CompletableFuture<String> requestToolCall(String name, String argumentsJson);
    }

    /** Kagaz fork addition. Implemented by LLMPlugin to forward the request to JS as an event. */
    public interface ToolCallListener {
        void onToolCallRequested(String requestId, String name, String argumentsJson);
    }

    public void sendMessage(String chatId, String message, MessageCallback callback) {
        ChatSession session;
        LlmInference inference;
        Integer sessionTopk;
        Float sessionTemperature;
        synchronized (this) {
            session = chatSessions.get(chatId);
            if (session == null) {
                throw new IllegalStateException("Chat session not found");
            }

            if (!isReady) {
                throw new IllegalStateException("Model not ready");
            }

            inference = llmInference;
            sessionTopk = topk;
            sessionTemperature = temperature;
        }

        if (session.backendType == BackendType.LITERT) {
            sendMessageWithLiteRt(chatId, message, session, callback);
            return;
        }

        if (inference == null) {
            throw new IllegalStateException("MediaPipe model not ready");
        }

        sendMessageWithMediaPipe(chatId, message, session, inference, sessionTopk, sessionTemperature, callback);
    }

    private void sendMessageWithLiteRt(String chatId, String message, ChatSession session, MessageCallback callback) {
        if (session.conversation == null) {
            throw new IllegalStateException("LiteRT-LM conversation not found");
        }

        session.conversation.sendMessageAsync(
            message,
            new com.google.ai.edge.litertlm.MessageCallback() {
                @Override
                public void onMessage(Message responseMessage) {
                    String chunk = extractText(responseMessage);
                    if (!chunk.isEmpty()) {
                        callback.onTextReceived(chatId, chunk, true);
                    }
                }

                @Override
                public void onDone() {
                    callback.onComplete(chatId);
                }

                @Override
                public void onError(Throwable throwable) {
                    callback.onError(throwable.getMessage());
                }
            },
            Collections.emptyMap()
        );
    }

    private String extractText(Message responseMessage) {
        StringBuilder builder = new StringBuilder();

        for (Content content : responseMessage.getContents().getContents()) {
            if (content instanceof Content.Text) {
                builder.append(((Content.Text) content).getText());
            }
        }

        return builder.toString();
    }

    private void sendMessageWithMediaPipe(
        String chatId,
        String message,
        ChatSession session,
        LlmInference inference,
        Integer sessionTopk,
        Float sessionTemperature,
        MessageCallback callback
    ) {
        executor.execute(() -> {
            LlmInferenceSession inferenceSession = null;
            try {
                session.addMessage("user", message);

                String fullPrompt = session.buildPrompt();
                android.util.Log.d("LLM", "Full prompt: " + fullPrompt);

                LlmInferenceSession.LlmInferenceSessionOptions sessionOptions = LlmInferenceSession.LlmInferenceSessionOptions.builder()
                    .setTopK(sessionTopk)
                    .setTemperature(sessionTemperature)
                    .build();

                inferenceSession = LlmInferenceSession.createFromOptions(inference, sessionOptions);
                LlmInferenceSession activeSession = inferenceSession;

                inferenceSession.addQueryChunk(fullPrompt);

                final StringBuilder fullResponse = new StringBuilder();

                com.google.mediapipe.tasks.genai.llminference.ProgressListener<String> resultListener =
                    new com.google.mediapipe.tasks.genai.llminference.ProgressListener<String>() {
                        private StringBuilder buffer = new StringBuilder();
                        private boolean hasStarted = false;

                        @Override
                        public void run(String partialResult, boolean done) {
                            android.util.Log.d("LLM", "Partial result: " + partialResult + ", done: " + done);

                            buffer.append(partialResult);

                            String content = buffer.toString();
                            StringBuilder toSend = new StringBuilder();
                            int i = 0;
                            while (i < content.length()) {
                                if (i < content.length() - 1 && content.charAt(i) == '\\' && content.charAt(i + 1) == 'n') {
                                    toSend.append('\n');
                                    i += 2;
                                } else if (i == content.length() - 1 && content.charAt(i) == '\\' && !done) {
                                    break;
                                } else {
                                    toSend.append(content.charAt(i));
                                    i++;
                                }
                            }

                            buffer = new StringBuilder(content.substring(i));

                            String chunk = toSend.toString();

                            if (!hasStarted && !chunk.isEmpty()) {
                                chunk = chunk.replaceFirst("^\\n", "");
                                hasStarted = true;
                            }

                            if (!chunk.isEmpty()) {
                                callback.onTextReceived(chatId, chunk, true);
                                fullResponse.append(chunk);
                            }

                            if (done && buffer.length() > 0) {
                                String remaining = buffer.toString();
                                if (!remaining.isEmpty()) {
                                    callback.onTextReceived(chatId, remaining, true);
                                    fullResponse.append(remaining);
                                }
                            }

                            if (done) {
                                session.addMessage("assistant", fullResponse.toString());
                                callback.onComplete(chatId);
                                closeMediaPipeSession(activeSession);
                            }
                        }
                    };

                inferenceSession.generateResponseAsync(resultListener);
            } catch (Exception exception) {
                closeMediaPipeSession(inferenceSession);
                callback.onError(exception.getMessage());
            }
        });
    }

    public synchronized String getReadiness() {
        return isReady ? "ready" : "not_ready";
    }

    /**
     * Kagaz fork addition. The backend requested at load time (LiteRT-LM
     * exposes no way to confirm a GPU delegate actually engaged rather than
     * silently falling back, so this is an honest "what we asked for", not
     * "what's definitely running").
     */
    public synchronized String getRequestedBackendName() {
        return requestedBackend;
    }

    /** Kagaz fork addition. Wall-clock time the most recent successful load took. */
    public synchronized long getLastLoadDurationMs() {
        return lastLoadDurationMs;
    }

    /**
     * Kagaz fork addition. SHA-256 of a file already on disk, run off the
     * caller's thread by LLMPlugin (this method itself does no threading —
     * it's meant to be called from inside an already-background context).
     * Not present upstream. `[SEC]` §5 requires verifying model integrity
     * before every load, not just the first one.
     */
    public static String sha256File(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) > 0) {
                digest.update(buffer, 0, length);
            }
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte b : digest.digest()) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    private synchronized void resetModelState() {
        clearChatSessions();

        closeEngine(engine);
        closeLlmInference(llmInference);
        engine = null;
        llmInference = null;
        modelPath = null;
        modelType = null;
        isReady = false;
    }

    private void closeEngine(Engine loadedEngine) {
        if (loadedEngine != null) {
            try {
                loadedEngine.close();
            } catch (Exception exception) {
                android.util.Log.w("LLM", "Failed to close LiteRT-LM engine", exception);
            }
        }
    }

    private void closeMediaPipeSession(LlmInferenceSession inferenceSession) {
        if (inferenceSession != null) {
            try {
                inferenceSession.close();
            } catch (Exception exception) {
                android.util.Log.e("LLM", "Failed to close MediaPipe session", exception);
            }
        }
    }

    private void closeLlmInference(LlmInference inference) {
        if (inference != null) {
            try {
                inference.close();
            } catch (Exception exception) {
                android.util.Log.w("LLM", "Failed to close MediaPipe model", exception);
            }
        }
    }

    private void clearChatSessions() {
        for (ChatSession session : chatSessions.values()) {
            if (session.conversation != null) {
                try {
                    session.conversation.close();
                } catch (Exception exception) {
                    android.util.Log.w("LLM", "Failed to close LiteRT-LM conversation", exception);
                }
            }
        }

        chatSessions.clear();
    }

    public interface MessageCallback {
        void onTextReceived(String chatId, String text, boolean isChunk);
        void onComplete(String chatId);
        void onError(String error);
    }

    public interface ModelLoadCallback {
        void onSuccess();
        void onError(String error);
    }

    private static class ChatSession {

        private final BackendType backendType;
        private final Conversation conversation;
        private final StringBuilder history;

        private ChatSession(BackendType backendType, Conversation conversation) {
            this.backendType = backendType;
            this.conversation = conversation;
            this.history = new StringBuilder();
        }

        static ChatSession forLiteRt(Conversation conversation) {
            return new ChatSession(BackendType.LITERT, conversation);
        }

        static ChatSession forMediaPipe() {
            return new ChatSession(BackendType.MEDIAPIPE, null);
        }

        void addMessage(String role, String content) {
            if (history.length() > 0) {
                history.append("\n");
            }
            if (role.equals("user")) {
                history.append("User: ").append(content);
            } else {
                history.append("Assistant: ").append(content);
            }
        }

        String buildPrompt() {
            return history.toString();
        }
    }

    private static class ModelLoadRequest {

        private final String modelPath;
        private final String modelType;
        private final Integer maxTokens;
        private final Integer topk;
        private final Float temperature;
        private final Integer randomSeed;
        private final String backend;
        private final long loadId;

        private ModelLoadRequest(
            String modelPath,
            String modelType,
            Integer maxTokens,
            Integer topk,
            Float temperature,
            Integer randomSeed,
            String backend,
            long loadId
        ) {
            this.modelPath = modelPath;
            this.modelType = modelType;
            this.maxTokens = maxTokens;
            this.topk = topk;
            this.temperature = temperature;
            this.randomSeed = randomSeed;
            this.backend = backend;
            this.loadId = loadId;
        }
    }
}
