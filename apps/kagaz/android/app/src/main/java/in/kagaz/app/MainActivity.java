package in.kagaz.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // SEC-V1 §8 #10: register the root-detection plugin before the bridge.
        registerPlugin(RootCheckPlugin.class);
        // F-20 OCR (ADR-019): bundled ML Kit text recognition.
        registerPlugin(OcrPlugin.class);
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
}
