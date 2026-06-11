/**
 * Type-safe translation keys (docs/architecture/12-i18n-multilingual.md
 * §3.4). English files are the schema; t('...') autocompletes and
 * type-errors on unknown keys.
 */
import type en_common from './locales/en/common.json';
import type en_documents from './locales/en/documents.json';
import type en_aiAssistant from './locales/en/ai-assistant.json';
import type en_settings from './locales/en/settings.json';
import type en_scanner from './locales/en/scanner.json';
import type en_tools from './locales/en/tools.json';

/** Namespace → resource shape map (V1 namespaces). */
export interface TranslationResources {
  common: typeof en_common;
  documents: typeof en_documents;
  'ai-assistant': typeof en_aiAssistant;
  settings: typeof en_settings;
  scanner: typeof en_scanner;
  tools: typeof en_tools;
}

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: TranslationResources;
  }
}
