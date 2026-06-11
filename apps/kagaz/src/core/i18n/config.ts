/**
 * i18n initialization (docs/architecture/12-i18n-multilingual.md §3.3).
 * react-i18next + browser language detector + lazy-loaded JSON resources.
 * V1 ships en + hi; the V2/V3 namespaces exist as placeholders so the
 * namespace list never changes shape between versions.
 */
// i18next's default-export singleton is the documented API; import-x's
// named-export cautions are false positives here.
// eslint-disable-next-line import-x/no-named-as-default
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import resourcesToBackend from 'i18next-resources-to-backend';

/** V1 launch languages (12-i18n §2; ta/te/kn/ml/bn arrive in V2). */
export const SUPPORTED_LANGUAGES = ['en', 'hi'] as const;

/** One of the supported language codes. */
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Default/fallback language. */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

/** Translation namespaces (§4). sharing = V2, csc-services = V3. */
export const NAMESPACES = [
  'common',
  'documents',
  'ai-assistant',
  'settings',
  'scanner',
  'tools',
  'sharing',
  'csc-services',
] as const;

/**
 * Initializes (or returns the already-initialized) i18n singleton.
 * Exposed as a function so tests and the I18nProvider control timing.
 */
export async function initI18n(): Promise<typeof i18n> {
  if (i18n.isInitialized) {
    return i18n;
  }
  // eslint-disable-next-line import-x/no-named-as-default-member
  await i18n
    .use(
      resourcesToBackend(
        (language: string, namespace: string) =>
          import(`./locales/${language}/${namespace}.json`)
      )
    )
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      supportedLngs: [...SUPPORTED_LANGUAGES],
      fallbackLng: DEFAULT_LANGUAGE,
      ns: [...NAMESPACES],
      defaultNS: 'common',
      detection: {
        order: ['localStorage', 'navigator'],
        caches: ['localStorage'],
      },
      interpolation: {
        // React already escapes rendered values.
        escapeValue: false,
      },
      returnNull: false,
      returnEmptyString: false,
      debug: false,
    });
  return i18n;
}

export default i18n;
