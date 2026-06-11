import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatFileSize,
  formatNumber,
  formatRelativeTime,
} from '../utils';

describe('formatDate / formatDateTime', () => {
  it('renders long dates per locale', () => {
    expect(formatDate('2026-06-07T00:00:00Z', 'en-IN')).toContain('June');
    expect(formatDate('2026-06-07T00:00:00Z', 'hi-IN')).toContain('जून');
  });

  it('formatDateTime includes time parts', () => {
    const out = formatDateTime('2026-06-07T10:30:00', 'en-IN');
    expect(out).toMatch(/10[:.]30/);
  });
});

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-11T12:00:00Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('covers now / minutes / hours / days branches', () => {
    expect(formatRelativeTime('2026-06-11T11:59:40Z', 'en')).toMatch(
      /now|this minute/i
    );
    expect(formatRelativeTime('2026-06-11T11:55:00Z', 'en')).toContain(
      '5 minutes ago'
    );
    expect(formatRelativeTime('2026-06-11T09:00:00Z', 'en')).toContain(
      '3 hours ago'
    );
    expect(formatRelativeTime('2026-06-09T12:00:00Z', 'en')).toMatch(
      /2 days ago|day before yesterday/
    );
  });

  it('localizes to Hindi', () => {
    expect(formatRelativeTime('2026-06-11T09:00:00Z', 'hi')).toContain('घंटे');
  });
});

describe('formatNumber', () => {
  it('uses the Indian grouping system for en-IN', () => {
    expect(formatNumber(125000, 'en-IN')).toBe('1,25,000');
  });
});

describe('formatFileSize', () => {
  it('walks the unit ladder', () => {
    expect(formatFileSize(512, 'en-IN')).toBe('512 B');
    expect(formatFileSize(2048, 'en-IN')).toBe('2 KB');
    expect(formatFileSize(2.5 * 1024 * 1024, 'en-IN')).toBe('2.5 MB');
    expect(formatFileSize(3 * 1024 ** 3, 'en-IN')).toBe('3 GB');
  });

  it('caps at GB', () => {
    expect(formatFileSize(5000 * 1024 ** 3, 'en-IN')).toContain('GB');
  });
});

describe('formatCurrency', () => {
  it('always formats INR', () => {
    expect(formatCurrency(1500, 'en-IN')).toContain('₹');
    expect(formatCurrency(1500, 'en-IN')).toContain('1,500');
  });
});
