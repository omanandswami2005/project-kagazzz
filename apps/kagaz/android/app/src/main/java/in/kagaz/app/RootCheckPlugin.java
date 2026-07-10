package in.kagaz.app;

import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

/**
 * SEC-V1 §8 #10: best-effort root/jailbreak detection (warning only, never a
 * hard block). Heuristics — test-keys build, common su binaries, known root
 * manager packages. False negatives are expected on cloaked roots; this only
 * surfaces an in-app warning so the user knows their data is at higher risk.
 */
@CapacitorPlugin(name = "RootCheck")
public class RootCheckPlugin extends Plugin {

    @PluginMethod
    public void isRooted(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("rooted", hasTestKeys() || hasSuBinary() || hasRootPackage());
        call.resolve(ret);
    }

    private boolean hasTestKeys() {
        String tags = Build.TAGS;
        return tags != null && tags.contains("test-keys");
    }

    private boolean hasSuBinary() {
        String[] paths = {
            "/system/bin/su", "/system/xbin/su", "/sbin/su", "/su/bin/su",
            "/system/app/Superuser.apk", "/data/local/xbin/su",
            "/data/local/bin/su", "/system/bin/.ext/.su"
        };
        for (String path : paths) {
            if (new File(path).exists()) {
                return true;
            }
        }
        return false;
    }

    private boolean hasRootPackage() {
        String[] packages = {
            "com.topjohnwu.magisk", "com.noshufou.android.su",
            "eu.chainfire.supersu", "com.koushikdutta.superuser"
        };
        for (String pkg : packages) {
            try {
                getContext().getPackageManager().getPackageInfo(pkg, 0);
                return true;
            } catch (Exception ignored) {
                // Not installed — keep checking.
            }
        }
        return false;
    }
}
