package in.kagaz.app;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.IOException;

/**
 * F-20 OCR (ADR-019): on-device text recognition via Google ML Kit, with the
 * Latin + Devanagari models **bundled in the APK** (no runtime download, no
 * network, no WASM/CSP). Recognizes text from a stored image file URI.
 *
 * [SEC] The recognized text is sensitive — it is returned to the WebView and
 * stored only in the encrypted DB by the caller. This plugin never logs it.
 */
@CapacitorPlugin(name = "Ocr")
public class OcrPlugin extends Plugin {

    @PluginMethod
    public void recognizeText(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("A file path is required.");
            return;
        }
        // 'latin' (English/Latin scripts) or 'devanagari' (Hindi); default latin.
        String script = call.getString("script", "latin");

        final InputImage image;
        try {
            image = InputImage.fromFilePath(getContext(), Uri.parse(path));
        } catch (IOException e) {
            call.reject("Could not read the image.");
            return;
        }

        final TextRecognizer recognizer = "devanagari".equalsIgnoreCase(script)
            ? TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build())
            : TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);

        recognizer
            .process(image)
            .addOnSuccessListener(text -> {
                JSObject ret = new JSObject();
                ret.put("text", text.getText());
                call.resolve(ret);
            })
            .addOnFailureListener(e -> call.reject("OCR failed."))
            .addOnCompleteListener(task -> recognizer.close());
    }
}
