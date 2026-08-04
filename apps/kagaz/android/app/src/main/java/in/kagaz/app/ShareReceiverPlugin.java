package in.kagaz.app;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;

/**
 * F-108 Receive Share (inbound counterpart to F-64/F-65's outbound document
 * intents): resolves an incoming Android {@code ACTION_SEND}/
 * {@code ACTION_SEND_MULTIPLE} intent (declared in AndroidManifest.xml) into
 * a plain JS-friendly payload — one or more {@code content://} URIs plus
 * their display name/MIME type, read from the *sending* app's own
 * FileProvider (not ours; no `file_paths.xml` change needed here).
 *
 * Two paths, because a `singleTask` launchMode activity gets a share two
 * different ways depending on whether it's already running:
 *  - cold/backgrounded start → {@link #getPendingShare} reads
 *    {@code getActivity().getIntent()} once the WebView has loaded and JS
 *    asks for it;
 *  - already-running (warm) → {@link MainActivity#onNewIntent} calls
 *    {@link #handleNewIntent} directly, which emits a `shareReceived` event.
 *
 * Either path consumes the intent (resets its action) after reading it, so
 * backgrounding/foregrounding the app afterward doesn't re-import the same
 * share a second time.
 */
@CapacitorPlugin(name = "ShareReceiver")
public class ShareReceiverPlugin extends Plugin {

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject payload = parseIntent(intent);
        consumeIntent(intent);
        call.resolve(payload);
    }

    /** Called from {@link MainActivity#onNewIntent} — not a PluginMethod. */
    void handleNewIntent(Intent intent) {
        String action = intent == null ? null : intent.getAction();
        boolean isShare = Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action);
        if (isShare) {
            notifyListeners("shareReceived", parseIntent(intent));
        }
        consumeIntent(intent);
    }

    private JSObject parseIntent(Intent intent) {
        JSObject result = new JSObject();
        JSArray items = new JSArray();
        result.put("items", items);
        result.put("text", (Object) null);

        if (intent == null) {
            return result;
        }
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            return result;
        }

        ArrayList<Uri> streams = new ArrayList<>();
        if (Intent.ACTION_SEND.equals(action)) {
            Uri stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (stream != null) {
                streams.add(stream);
            }
        } else {
            ArrayList<Uri> extras = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (extras != null) {
                streams.addAll(extras);
            }
        }

        ContentResolver resolver = getContext().getContentResolver();
        for (Uri uri : streams) {
            JSObject item = new JSObject();
            item.put("uri", uri.toString());
            item.put("mimeType", resolver.getType(uri));
            item.put("name", resolveDisplayName(resolver, uri));
            items.put(item);
        }

        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text != null && !text.isEmpty()) {
            result.put("text", text);
        }
        return result;
    }

    /** Best-effort original filename via the content provider's OpenableColumns. */
    private String resolveDisplayName(ContentResolver resolver, Uri uri) {
        if (!"content".equals(uri.getScheme())) {
            return uri.getLastPathSegment();
        }
        try (Cursor cursor = resolver.query(uri, null, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (nameIndex >= 0) {
                    String name = cursor.getString(nameIndex);
                    if (name != null && !name.isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception e) {
            // Fall through to the path-segment fallback below.
        }
        return uri.getLastPathSegment();
    }

    /**
     * Replaces the activity's stored intent with a plain MAIN one so a later
     * `getPendingShare()` call (e.g. after backgrounding without acting on
     * the share) doesn't re-resolve the same content twice.
     */
    private void consumeIntent(Intent original) {
        if (original == null) {
            return;
        }
        String action = original.getAction();
        if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) {
            getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        }
    }
}
