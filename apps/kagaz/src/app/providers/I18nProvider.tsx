/**
 * i18n provider (P0-10): initializes the i18n singleton (P0-8) before
 * rendering and keeps <html lang>/<html dir> in sync (RTL-ready, 12-i18n §6).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { i18n, initI18n } from '@/core/i18n';
import { log } from '@/core/logging';

const logger = log('core');

/** Gates children until translations are ready. */
export function I18nProvider({ children }: { children: ReactNode }): ReactNode {
  const [ready, setReady] = useState(i18n.isInitialized);

  useEffect(() => {
    let cancelled = false;
    initI18n()
      .then(() => {
        if (!cancelled) {
          setReady(true);
        }
      })
      .catch((error: unknown) => {
        logger.fatal({
          event: 'i18n.init.failed',
          err: { message: String(error) },
        });
      });
    return (): void => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return undefined;
    }
    const sync = (language: string): void => {
      document.documentElement.lang = language;
      document.documentElement.dir = i18n.dir(language);
    };
    sync(i18n.resolvedLanguage ?? i18n.language);
    i18n.on('languageChanged', sync);
    return (): void => i18n.off('languageChanged', sync);
  }, [ready]);

  if (!ready) {
    // Route-level skeletons come with the pages; never a >1s splash.
    return null;
  }
  return children;
}
