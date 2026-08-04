package in.kagaz.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // SEC-V1 §8 #10: register the root-detection plugin before the bridge.
        registerPlugin(RootCheckPlugin.class);
        // F-20 OCR (ADR-019): bundled ML Kit text recognition.
        registerPlugin(OcrPlugin.class);
        // F-108: inbound Android share-sheet intents (ACTION_SEND/_MULTIPLE).
        registerPlugin(ShareReceiverPlugin.class);
        super.onCreate(savedInstanceState);
        // [SEC] SEC-V1 §8 items #5 (screenshot prevention) + #6 (app-switcher
        // blur): this app holds Aadhaar/PAN-grade PII, so FLAG_SECURE blocks
        // screenshots / screen recording AND blanks the recent-apps preview.
        // See 10-security-architecture.md §3.1 / §8.
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );
    }

    /**
     * F-108: `launchMode="singleTask"` means a share arriving while the app
     * is already running (warm) delivers here instead of a fresh onCreate —
     * forward it to ShareReceiverPlugin so it can notify JS immediately
     * rather than waiting for the next getPendingShare() poll.
     */
    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        PluginHandle handle = getBridge().getPlugin("ShareReceiver");
        if (handle != null && handle.getInstance() instanceof ShareReceiverPlugin) {
            ((ShareReceiverPlugin) handle.getInstance()).handleNewIntent(intent);
        }
    }
}
