/**
 * Hash-chained, append-only audit log
 * ([SEC][LEGAL] docs/architecture/14-observability-logging.md §6).
 *
 * Audit records are legal evidence (DPDP consent logs, share access,
 * destructive-AI confirmations). Each record's hash covers the previous
 * record's hash — any edit or deletion breaks the chain detectably.
 * This DAO intentionally has NO update or delete methods.
 */
import type {
  DbConnection,
  SqlRow,
} from '@/infrastructure/database/connection';

/** Who performed the audited action. */
export type AuditActor = 'user' | 'ai-assistant' | 'system';

/** Input for a new audit record. */
export interface AuditEntry {
  actor: AuditActor;
  /** Dot-namespaced action, e.g. consent.granted, share.created. */
  action: string;
  /** Purpose / document ids / share id — NEVER content. */
  scope?: string;
  /** Correlates to server logs in V2+. */
  requestId?: string;
  /** Client/user-agent string. */
  ua?: string;
}

/** A stored audit record. */
export interface AuditRecord extends AuditEntry {
  seq: number;
  time: string;
  recordHash: string;
  prevHash: string;
}

/** Chain verification outcome. */
export interface ChainVerification {
  valid: boolean;
  records: number;
  brokenAtSeq?: number;
}

/** SHA-256 hex digest. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}

/** Deterministic JSON: keys sorted at every level. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`);
  return `{${entries.join(',')}}`;
}

function mapRow(row: SqlRow): AuditRecord {
  return {
    seq: row['seq'] as number,
    time: row['time'] as string,
    actor: row['actor'] as AuditActor,
    action: row['action'] as string,
    scope: (row['scope'] as string | null) ?? undefined,
    requestId: (row['request_id'] as string | null) ?? undefined,
    ua: (row['ua'] as string | null) ?? undefined,
    recordHash: row['record_hash'] as string,
    prevHash: row['prev_hash'] as string,
  };
}

function hashableOf(record: {
  time: string;
  actor: string;
  action: string;
  scope?: string;
  requestId?: string;
  ua?: string;
}): string {
  return canonicalJson({
    time: record.time,
    actor: record.actor,
    action: record.action,
    scope: record.scope ?? null,
    request_id: record.requestId ?? null,
    ua: record.ua ?? null,
  });
}

/** Append-only access to audit_logs. */
export class AuditLogDao {
  /**
   * @param db - open encrypted database
   * @param installId - stable per-install id; genesis prev_hash =
   *   SHA-256(installId)
   */
  constructor(
    private readonly db: DbConnection,
    private readonly installId: string
  ) {}

  /** Appends an audit record, extending the hash chain. */
  async append(entry: AuditEntry): Promise<AuditRecord> {
    const last = await this.db.query(
      'SELECT seq, record_hash FROM audit_logs ORDER BY seq DESC LIMIT 1'
    );
    const lastHash = last[0]?.['record_hash'];
    const prevHash =
      typeof lastHash === 'string' ? lastHash : await sha256Hex(this.installId);

    const time = new Date().toISOString();
    const recordHash = await sha256Hex(
      prevHash + hashableOf({ ...entry, time })
    );

    await this.db.run(
      `INSERT INTO audit_logs (time, actor, action, scope, request_id, ua,
        record_hash, prev_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        time,
        entry.actor,
        entry.action,
        entry.scope ?? null,
        entry.requestId ?? null,
        entry.ua ?? null,
        recordHash,
        prevHash,
      ]
    );

    const rows = await this.db.query(
      'SELECT * FROM audit_logs ORDER BY seq DESC LIMIT 1'
    );
    if (!rows[0]) {
      throw new Error('audit_logs insert did not persist');
    }
    return mapRow(rows[0]);
  }

  /** Lists records in chain order. */
  async list(): Promise<AuditRecord[]> {
    const rows = await this.db.query(
      'SELECT * FROM audit_logs ORDER BY seq ASC'
    );
    return rows.map(mapRow);
  }

  /**
   * Recomputes the full chain. Any tampered, deleted, or reordered
   * record reports the first broken seq.
   */
  async verifyChain(): Promise<ChainVerification> {
    const records = await this.list();
    let prevHash = await sha256Hex(this.installId);
    for (const record of records) {
      if (record.prevHash !== prevHash) {
        return { valid: false, records: records.length, brokenAtSeq: record.seq };
      }
      const expected = await sha256Hex(prevHash + hashableOf(record));
      if (expected !== record.recordHash) {
        return { valid: false, records: records.length, brokenAtSeq: record.seq };
      }
      prevHash = record.recordHash;
    }
    return { valid: true, records: records.length };
  }
}
