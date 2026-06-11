import './types';

export {
  default as i18n,
  initI18n,
  DEFAULT_LANGUAGE,
  NAMESPACES,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from './config';
export { useLocale, type LocaleInfo } from './hooks/useLocale';
export {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
} from './utils';
export type { TranslationResources } from './types';
