/**
 * Locale-aware formatting helpers
 * (docs/architecture/12-i18n-multilingual.md §5). All formatting goes
 * through the native Intl API — never hand-rolled date/number strings.
 */

/**
 * Maps a bare language code to its Indian formatting locale
 * ('en' → 'en-IN' Indian digit grouping; region-qualified codes pass
 * through unchanged).
 */
export function toFormattingLocale(language: string): string {
  return language.includes('-') ? language : `${language}-IN`;
}

/** "June 7, 2026" / "7 जून 2026". */
export function formatDate(date: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

/** "Jun 7, 2026, 02:30 PM" localized. */
export function formatDateTime(date: string | Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/** "3 hours ago" / "3 घंटे पहले" (auto "now"/"today" wording). */
export function formatRelativeTime(
  date: string | Date,
  locale: string
): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return rtf.format(0, 'minute');
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.floor(hours / 24);
  return rtf.format(-days, 'day');
}

/** Locale digit grouping — Indian system gives "1,25,000". */
export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** "2.5 MB" with locale-formatted number. */
export function formatFileSize(bytes: number, locale: string): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  }).format(size);
  return `${formatted} ${units[unitIndex]}`;
}

/** "₹1,500.00" — INR always (V3 fees, storage upsell). */
export function formatCurrency(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}
