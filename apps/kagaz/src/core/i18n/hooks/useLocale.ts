/**
 * useLocale — current locale info + pre-bound formatters
 * (docs/architecture/12-i18n-multilingual.md §3.2 hooks/).
 */
import { useTranslation } from 'react-i18next';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
  toFormattingLocale,
} from '../utils';

/** What {@link useLocale} returns. */
export interface LocaleInfo {
  /** Active language code (e.g. 'en', 'hi'). */
  locale: string;
  /** Text direction — 'rtl' only for Urdu (V3); prepared per §6. */
  dir: 'ltr' | 'rtl';
  formatDate: (date: string | Date) => string;
  formatDateTime: (date: string | Date) => string;
  formatRelativeTime: (date: string | Date) => string;
  formatNumber: (value: number) => string;
  formatFileSize: (bytes: number) => string;
  formatCurrency: (amount: number) => string;
}

/** Returns the active locale and formatters bound to it. */
export function useLocale(): LocaleInfo {
  const { i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;
  // Formatters use the India-region variant (en → en-IN) so digit
  // grouping follows the Indian system (1,25,000).
  const fmt = toFormattingLocale(locale);
  return {
    locale,
    dir: i18n.dir(locale),
    formatDate: (date) => formatDate(date, fmt),
    formatDateTime: (date) => formatDateTime(date, fmt),
    formatRelativeTime: (date) => formatRelativeTime(date, fmt),
    formatNumber: (value) => formatNumber(value, fmt),
    formatFileSize: (bytes) => formatFileSize(bytes, fmt),
    formatCurrency: (amount) => formatCurrency(amount, fmt),
  };
}
