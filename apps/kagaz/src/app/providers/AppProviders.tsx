/**
 * Combined provider wrapper (01-system-architecture app/ tree).
 * Order: ErrorBoundary → Theme → I18n → Database → AI.
 */
import type { ReactNode } from 'react';
import { ErrorBoundary } from '../ErrorBoundary';
import { AIProvider } from './AIProvider';
import { DatabaseProvider } from './DatabaseProvider';
import { I18nProvider } from './I18nProvider';
import { ThemeProvider } from './ThemeProvider';

/** Wraps the app in every global provider, outermost boundary first. */
export function AppProviders({ children }: { children: ReactNode }): ReactNode {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <I18nProvider>
          <DatabaseProvider>
            <AIProvider>{children}</AIProvider>
          </DatabaseProvider>
        </I18nProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
