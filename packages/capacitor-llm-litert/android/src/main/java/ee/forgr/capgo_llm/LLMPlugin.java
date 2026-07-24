package ee.forgr.capgo_llm;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "CapgoLLM")
public class LLMPlugin extends Plugin {

    private final String pluginVersion = "8.1.3-kagaz.1"; // Kagaz fork — see packages/capacitor-llm-litert's own README for the diff against upstream 8.1.3

    private LLM llm;

    @Override
    public void load() {
        super.load();
        llm = LLM.getInstance(getContext());
        // Kagaz fork addition — every native tool call becomes this event.
        llm.setToolCallListener((requestId, name, argumentsJson) -> {
            JSObject event = new JSObject();
            event.put("requestId", requestId);
            event.put("name", name);
            event.put("argumentsJson", argumentsJson);
            notifyListeners("toolCallRequested", event);
        });
    }

    // Kagaz fork addition. Parses ModelOptions.tools (a JSArray of
    // {name, descriptionJson}) into LLM.ToolSpec. Absent/malformed entries
    // are skipped rather than failing the whole setModel call — a single
    // bad tool description shouldn't block the model from loading at all.
    private List<LLM.ToolSpec> parseTools(PluginCall call) {
        List<LLM.ToolSpec> tools = new ArrayList<>();
        JSArray raw = call.getArray("tools");
        if (raw == null) {
            return tools;
        }
        for (int i = 0; i < raw.length(); i++) {
            try {
                JSONObject entry = raw.getJSONObject(i);
                String name = entry.getString("name");
                String descriptionJson = entry.getString("descriptionJson");
                tools.add(new LLM.ToolSpec(name, descriptionJson));
            } catch (JSONException malformed) {
                android.util.Log.w("LLMPlugin", "Skipping malformed tool entry at index " + i, malformed);
            }
        }
        return tools;
    }

    @PluginMethod
    public void createChat(PluginCall call) {
        try {
            String chatId = llm.createChat();
            JSObject ret = new JSObject();
            ret.put("id", chatId);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to create chat", e);
        }
    }

    @PluginMethod
    public void sendMessage(PluginCall call) {
        String chatId = call.getString("chatId");
        String message = call.getString("message");

        if (chatId == null || message == null) {
            call.reject("chatId and message are required");
            return;
        }

        try {
            llm.sendMessage(
                chatId,
                message,
                new LLM.MessageCallback() {
                    @Override
                    public void onTextReceived(String chatId, String text, boolean isChunk) {
                        JSObject event = new JSObject();
                        event.put("text", text);
                        event.put("chatId", chatId);
                        event.put("isChunk", isChunk);
                        notifyListeners("textFromAi", event);
                    }

                    @Override
                    public void onComplete(String chatId) {
                        JSObject event = new JSObject();
                        event.put("chatId", chatId);
                        notifyListeners("aiFinished", event);
                    }

                    @Override
                    public void onError(String error) {
                        JSObject event = new JSObject();
                        event.put("chatId", chatId);
                        event.put("error", error);
                        notifyListeners("generationError", event);
                    }
                }
            );

            call.resolve();
        } catch (IllegalStateException exception) {
            call.reject(exception.getMessage());
        }
    }

    @PluginMethod
    public void getReadiness(PluginCall call) {
        String readiness = llm.getReadiness();
        JSObject ret = new JSObject();
        ret.put("readiness", readiness);
        call.resolve(ret);

        // Also notify listeners
        JSObject readinessData = new JSObject();
        readinessData.put("readiness", readiness);
        notifyListeners("readinessChange", readinessData);
    }

    @PluginMethod
    public void setModel(PluginCall call) {
        String path = call.getString("path");

        if (path == null) {
            call.reject("path is required");
            return;
        }

        // Extract model parameters
        Integer maxTokens = call.getInt("maxTokens", 2048);
        Integer topk = call.getInt("topk", 40);
        Float temperature = call.getFloat("temperature", 0.8f);
        Integer randomSeed = call.getInt("randomSeed", 0);
        String modelType = call.getString("modelType");
        String backend = call.getString("backend");
        List<LLM.ToolSpec> tools = parseTools(call); // Kagaz fork addition

        llm.setModel(
            path,
            modelType,
            maxTokens,
            topk,
            temperature,
            randomSeed,
            backend,
            tools,
            new LLM.ModelLoadCallback() {
                @Override
                public void onSuccess() {
                    // Notify readiness change
                    JSObject readinessData = new JSObject();
                    readinessData.put("readiness", "ready");
                    notifyListeners("readinessChange", readinessData);
                    call.resolve();
                }

                @Override
                public void onError(String error) {
                    // Notify readiness change
                    JSObject readinessData = new JSObject();
                    readinessData.put("readiness", "Failed to load model: " + error);
                    notifyListeners("readinessChange", readinessData);
                    call.reject("Failed to load model", error);
                }
            }
        );
    }

    @PluginMethod
    public void downloadModel(PluginCall call) {
        String url = call.getString("url");
        String companionUrl = call.getString("companionUrl");
        String filename = call.getString("filename");

        if (url == null) {
            call.reject("url is required");
            return;
        }

        // If no filename provided, extract from URL
        if (filename == null) {
            String[] parts = url.split("/");
            filename = parts[parts.length - 1];
        }

        final String finalFilename = filename;

        new Thread(() -> {
            try {
                // Download main model file
                java.io.File filesDir = getContext().getFilesDir();
                java.io.File modelFile = new java.io.File(filesDir, finalFilename);

                downloadFile(url, modelFile, (progress) -> {
                    JSObject event = new JSObject();
                    event.put("progress", progress);
                    notifyListeners("downloadProgress", event);
                });

                JSObject ret = new JSObject();
                ret.put("path", modelFile.getAbsolutePath());

                // Download companion file if provided
                if (companionUrl != null) {
                    String companionFilename = companionUrl.substring(companionUrl.lastIndexOf("/") + 1);
                    java.io.File companionFile = new java.io.File(filesDir, companionFilename);

                    downloadFile(companionUrl, companionFile, (progress) -> {
                        JSObject event = new JSObject();
                        event.put("progress", progress);
                        notifyListeners("downloadProgress", event);
                    });

                    ret.put("companionPath", companionFile.getAbsolutePath());
                }

                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Failed to download model", e.getMessage());
            }
        })
            .start();
    }

    private void downloadFile(String urlString, java.io.File outputFile, ProgressCallback callback) throws Exception {
        java.net.URL url = new java.net.URL(urlString);
        java.net.HttpURLConnection connection = (java.net.HttpURLConnection) url.openConnection();
        connection.connect();

        int fileLength = connection.getContentLength();
        java.io.InputStream input = new java.io.BufferedInputStream(connection.getInputStream());
        java.io.FileOutputStream output = new java.io.FileOutputStream(outputFile);

        byte[] data = new byte[4096];
        long total = 0;
        int count;

        while ((count = input.read(data)) != -1) {
            total += count;
            if (fileLength > 0 && callback != null) {
                callback.onProgress((int) ((total * 100) / fileLength));
            }
            output.write(data, 0, count);
        }

        output.flush();
        output.close();
        input.close();
    }

    interface ProgressCallback {
        void onProgress(int percentage);
    }

    @PluginMethod
    public void getPluginVersion(final PluginCall call) {
        try {
            final JSObject ret = new JSObject();
            ret.put("version", this.pluginVersion);
            call.resolve(ret);
        } catch (final Exception e) {
            call.reject("Could not get plugin version", e);
        }
    }

    // --- Kagaz fork additions below — none of this exists upstream. ---

    @PluginMethod
    public void sha256File(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("path is required");
            return;
        }

        new Thread(() -> {
            try {
                String hash = LLM.sha256File(new File(path));
                JSObject ret = new JSObject();
                ret.put("hash", hash);
                call.resolve(ret);
            } catch (Exception exception) {
                call.reject("Failed to hash file", exception);
            }
        })
            .start();
    }

    @PluginMethod
    public void deleteModel(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("path is required");
            return;
        }

        new Thread(() -> {
            File file = new File(path);
            if (file.exists() && !file.delete()) {
                call.reject("Failed to delete model file");
                return;
            }
            call.resolve();
        })
            .start();
    }

    @PluginMethod
    public void resolveToolCall(PluginCall call) {
        String requestId = call.getString("requestId");
        String resultJson = call.getString("resultJson");
        if (requestId == null || resultJson == null) {
            call.reject("requestId and resultJson are required");
            return;
        }

        // A false return (unknown/already-resolved requestId) is a benign
        // race — see LLM.resolveToolCall()'s doc comment — not an error.
        llm.resolveToolCall(requestId, resultJson);
        call.resolve();
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("backend", llm.getRequestedBackendName());
        ret.put("loadTimeMs", llm.getLastLoadDurationMs());
        call.resolve(ret);
    }
}
