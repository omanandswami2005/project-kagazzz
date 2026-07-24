import { registerPlugin } from '@capacitor/core';

import type { LLMPlugin } from './definitions';

// 'CapgoLLM' is the wire-protocol plugin name — must match
// @CapacitorPlugin(name = "CapgoLLM") in LLMPlugin.java exactly. Only the
// exported JS binding is renamed for this fork's own clarity.
const CapacitorLlmLiteRT = registerPlugin<LLMPlugin>('CapgoLLM', {
  web: () => import('./web').then((m) => new m.CapgoLLMWeb()),
});

export * from './definitions';
export { CapacitorLlmLiteRT };
