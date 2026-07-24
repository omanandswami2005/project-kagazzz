package ee.forgr.capgo_llm;

import com.google.ai.edge.litertlm.OpenApiTool;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

/**
 * Kagaz fork addition (not present upstream). Bridges one native
 * LiteRT-LM tool call to the JS layer and back.
 *
 * LiteRT-LM's `automaticToolCalling` mode (default true, see LLM.java's
 * createLiteRtConversation()) calls execute() on a background executor
 * thread whenever the model wants to invoke this tool, and automatically
 * feeds the returned JSON back to the model to continue generation — so
 * this class never touches the conversation/message flow directly, it
 * only has to answer execute() correctly.
 *
 * execute() blocks (never on the Android main thread — LLM.java's
 * single-thread executor guarantees that) until the JS side calls
 * resolveToolCall() for the same requestId, or 30s pass. This is where
 * user-confirmation UI for destructive tool calls happens: the JS-side
 * ToolCallingEngine.executeTool() decides whether to show a confirmation
 * card before it ever calls resolveToolCall(), so the native side is
 * simply unaware of that distinction — it just waits for an answer.
 */
public class JsBridgeTool implements OpenApiTool {

    private final String name;
    private final String toolDescriptionJsonString;
    private final LLM.ToolCallBridge bridge;

    public JsBridgeTool(String name, String toolDescriptionJsonString, LLM.ToolCallBridge bridge) {
        this.name = name;
        this.toolDescriptionJsonString = toolDescriptionJsonString;
        this.bridge = bridge;
    }

    @Override
    public String getToolDescriptionJsonString() {
        return toolDescriptionJsonString;
    }

    @Override
    public String execute(String paramsJsonString) {
        try {
            return bridge.requestToolCall(name, paramsJsonString).get(30, TimeUnit.SECONDS);
        } catch (TimeoutException timeout) {
            return "{\"error\":\"Tool call timed out waiting for the app\"}";
        } catch (Exception exception) {
            String message = exception.getMessage() != null ? exception.getMessage() : exception.toString();
            return "{\"error\":\"" + message.replace("\"", "'") + "\"}";
        }
    }
}
