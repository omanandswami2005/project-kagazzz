/**
 * Root/jailbreak detection bridge (SEC-V1 §8 #10). The heuristics run natively
 * (a WebView can't inspect the filesystem) in RootCheckPlugin; web and any other
 * platform report not-rooted.
 */
import { registerPlugin } from '@capacitor/core';

/** Native root-check surface. */
export interface RootCheckPlugin {
  isRooted(): Promise<{ rooted: boolean }>;
}

export const RootCheck = registerPlugin<RootCheckPlugin>('RootCheck', {
  web: () =>
    Promise.resolve({ isRooted: () => Promise.resolve({ rooted: false }) }),
});
