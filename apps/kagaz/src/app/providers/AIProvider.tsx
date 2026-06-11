/**
 * AI provider (P0-10): the mount point for the on-device WebLLM engine.
 * The engine itself ships with F-13 (ai-assistant module); until then the
 * status is permanently 'not-loaded' and the assistant UI does not render.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Lifecycle of the on-device model (F-13 will drive transitions). */
export type AiStatus = 'not-loaded' | 'loading' | 'ready' | 'error';

/** What AIContext exposes. */
export interface AiContextValue {
  status: AiStatus;
}

const AiContext = createContext<AiContextValue | null>(null);

/** Provides AI engine status app-wide. */
export function AIProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useMemo<AiContextValue>(() => ({ status: 'not-loaded' }), []);
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

/** Access the AI engine status; throws outside the provider. */
export function useAi(): AiContextValue {
  const ctx = useContext(AiContext);
  if (!ctx) {
    throw new Error('useAi must be used inside <AIProvider>');
  }
  return ctx;
}
