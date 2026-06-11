import type { CapacitorConfig } from '@capacitor/cli';

// Platform targets per docs/architecture/01-system-architecture.md
// §Capacitor Platform Targets: Android API 24+ (primary), iOS 15+.
// [SEC] 10-security-architecture.md §3.5: V1 is 100% offline — the dev
// server block below must never gain `url`/`cleartext` remote-loading
// entries, and AndroidManifest.xml requests no network permissions.
const config: CapacitorConfig = {
  appId: 'in.kagaz.app',
  appName: 'Kagaz',
  webDir: 'dist',
  android: {
    // Defense in depth on top of the manifest having no INTERNET permission.
    allowMixedContent: false,
  },
  ios: {
    // Local scheme only; no remote content.
    contentInset: 'automatic',
  },
};

export default config;
