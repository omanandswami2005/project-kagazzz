/**
 * Recognises Indian ID numbers in text that is already on the phone
 * (a document's extracted text, a Quick Note) so the app can offer to keep
 * them in the locked Quick Reference (screen audit QR-2, QN-2, VW-9).
 * Pure functions: nothing is stored, logged or sent from here.
 *
 * [COMPLIANCE — check again before publication] Aadhaar numbers are offered
 * MASKED by default (only the last 4 digits kept), following UIDAI's masked-
 * Aadhaar guidance; the user can choose to keep the full number in their own
 * locked Quick Reference. Counsel should confirm this default before release
 * (docs/indian-compliance-checklist.md, docs/ux/screen-audit.md QR-2).
 */

/** The kinds of ID this module recognises. */
export type IdKind = 'pan' | 'aadhaar';

/** One ID number found in text. */
export interface DetectedId {
  kind: IdKind;
  /** Normalised value: PAN upper-case, Aadhaar as "1234 5678 9012". */
  value: string;
}

/** PAN: 5 letters, 4 digits, 1 letter; the 4th letter is the holder type. */
const PAN_RE = /\b[A-Z]{3}[ABCFGHJLPT][A-Z]\d{4}[A-Z]\b/gi;
/** Aadhaar: 12 digits, first is 2-9, optionally grouped 4-4-4. */
const AADHAAR_RE = /\b[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}\b/g;

// Verhoeff tables — UIDAI uses the Verhoeff checksum for Aadhaar's last digit.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** True when a digit string passes the Verhoeff check (used by Aadhaar). */
export function isVerhoeffValid(digits: string): boolean {
  let c = 0;
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i++) {
    const row = D[c];
    const perm = P[i % 8];
    if (!row || !perm) return false;
    c = row[perm[Number(reversed[i])] ?? 0] ?? 0;
  }
  return c === 0;
}

const digitsOnly = (s: string): string => s.replace(/\D/g, '');
const groupAadhaar = (d: string): string => `${d.slice(0, 4)} ${d.slice(4, 8)} ${d.slice(8)}`;

/** Distinct PAN and (checksum-valid) Aadhaar numbers in `text`, first-seen order. */
export function detectIdNumbers(text: string): DetectedId[] {
  if (!text?.trim()) return [];
  const out: DetectedId[] = [];
  const seen = new Set<string>();
  const add = (kind: IdKind, value: string): void => {
    if (seen.has(value)) return;
    seen.add(value);
    out.push({ kind, value });
  };
  for (const m of text.match(PAN_RE) ?? []) add('pan', m.toUpperCase());
  for (const m of text.match(AADHAAR_RE) ?? []) {
    const d = digitsOnly(m);
    if (d.length === 12 && isVerhoeffValid(d)) add('aadhaar', groupAadhaar(d));
  }
  return out;
}

/** "XXXX XXXX 9012" — the masked Aadhaar form (last 4 digits only). */
export function maskAadhaar(value: string): string {
  return `XXXX XXXX ${digitsOnly(value).slice(-4)}`;
}

/** True when `saved` already holds `id` (exact, or a masked Aadhaar with the same last 4). */
export function isAlreadySaved(id: DetectedId, saved: readonly string[]): boolean {
  const target = id.kind === 'pan' ? id.value : digitsOnly(id.value);
  return saved.some((v) => {
    if (id.kind === 'pan') return v.trim().toUpperCase() === target;
    const d = digitsOnly(v);
    return d === target || (/x/i.test(v) && d.length === 4 && target.endsWith(d));
  });
}
