/**
 * Central redaction denylist
 * ([SEC] docs/architecture/14-observability-logging.md §7).
 *
 * pino's `redact` option is a no-op in browser mode, so redaction is
 * enforced HERE, applied to every record before it reaches any sink or
 * the dev console — never left to call-site discipline. A leaked PII log
 * line is a DPDP data breach; treat changes to this list as security
 * changes reviewed against 10-security-architecture.md.
 */

/** Denylist paths (spec §7, verbatim). */
export const REDACT_PATHS = [
  'password',
  '*.password',
  'pin',
  '*.pin',
  'secret',
  '*.secret',
  'key',
  '*.key',
  'token',
  '*.token',
  'ocrText',
  '*.ocrText',
  'content',
  '*.content',
  'aadhaar',
  '*.aadhaar',
  'pan',
  '*.pan',
  'messages',
  '*.messages',
  'filePathAbsolute',
  '*.filePathAbsolute',
  'quickReferenceLabel',
  '*.quickReferenceLabel',
  'quickReferenceValue',
  '*.quickReferenceValue',
] as const;

/** Replacement value for redacted fields. */
export const REDACTION_CENSOR = '[REDACTED]';

/**
 * Key names redacted at any depth (the `*.x` wildcards make every name
 * in REDACT_PATHS depth-independent).
 */
const DENY_KEYS: ReadonlySet<string> = new Set(
  REDACT_PATHS.map((p) => p.replace(/^\*\./, ''))
);

const MAX_DEPTH = 16;

function redactValue(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth > MAX_DEPTH) {
    // Bug-audit fix: this used to return the raw, un-redacted subtree once
    // the cycle-safety depth cap was hit — silently contradicting this
    // module's own "redacts every denylisted key at any nesting depth"
    // claim (a denylisted key nested past MAX_DEPTH passed straight
    // through). Traversal correctly stops here for cycle-safety, but
    // "too deep to safely inspect" must censor, not leak, on a PII app.
    return REDACTION_CENSOR;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = DENY_KEYS.has(key)
      ? REDACTION_CENSOR
      : redactValue(child, depth + 1);
  }
  return out;
}

/**
 * Returns a deep copy of `value` with every denylisted key replaced by
 * {@link REDACTION_CENSOR}, at any nesting depth. Arrays are traversed;
 * primitives pass through; depth is capped to stay cycle-safe.
 */
export function redactRecord<T>(value: T): T {
  return redactValue(value, 0) as T;
}
