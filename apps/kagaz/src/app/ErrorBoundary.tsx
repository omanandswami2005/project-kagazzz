/**
 * Root error boundary ([SEC] errors are logged locally only — no remote
 * crash reporting in V1; 14-observability §10).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { i18n } from '@/core/i18n';
import { log } from '@/core/logging';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const logger = log('app');

/** Catches render crashes, logs fatal locally, offers recovery. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.fatal({
      event: 'app.crash.boundary',
      err: { type: error.name, message: error.message, stack: error.stack },
      componentStack: info.componentStack,
    });
  }

  private readonly reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div role="alert" className="kg-crash" data-agent-id="app.crash-screen">
          {/* Localized via the global i18n instance (this boundary sits outside
              I18nProvider, so no hook). Guard on isInitialized: if the crash
              happened before i18n loaded, t() would return the raw key — fall
              back to English so the recovery screen is always legible. */}
          <h1>
            {i18n.isInitialized
              ? i18n.t('crash.title')
              : 'Something went wrong'}
          </h1>
          <p>
            {i18n.isInitialized
              ? i18n.t('crash.body')
              : 'Your documents are safe. Restart the app to continue.'}
          </p>
          <button
            type="button"
            className="kg-btn kg-btn--primary kg-btn--md"
            onClick={this.reload}
            data-agent-id="app.crash.reload-btn"
            data-agent-state="idle"
          >
            {i18n.isInitialized ? i18n.t('crash.restart') : 'Restart'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
