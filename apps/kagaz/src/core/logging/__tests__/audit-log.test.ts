/**
 * Hash-chain tests run against a real in-memory table emulation: the
 * FakeDb is extended with enough behavior to store and return rows so
 * verifyChain exercises real hashes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { RunResult, SqlRow, SqlValue } from '@/infrastructure/database/connection';
import { FakeDb } from '@/test/fake-db';
import {
  AuditLogDao,
  canonicalJson,
  sha256Hex,
} from '../audit-log.dao';

/** FakeDb that actually stores audit rows. */
class AuditFakeDb extends FakeDb {
  readonly rows: SqlRow[] = [];

  override run(sql: string, params: SqlValue[] = []): Promise<RunResult> {
    if (sql.includes('INSERT INTO audit_logs')) {
      this.rows.push({
        seq: this.rows.length + 1,
        time: params[0],
        actor: params[1],
        action: params[2],
        scope: params[3],
        request_id: params[4],
        ua: params[5],
        record_hash: params[6],
        prev_hash: params[7],
      });
    }
    return super.run(sql, params);
  }

  override query(sql: string, params: SqlValue[] = []): Promise<SqlRow[]> {
    if (sql.includes('FROM audit_logs')) {
      if (sql.includes('ORDER BY seq DESC LIMIT 1')) {
        return Promise.resolve(this.rows.slice(-1));
      }
      return Promise.resolve([...this.rows]);
    }
    return super.query(sql, params);
  }
}

describe('sha256Hex / canonicalJson', () => {
  it('produces the known SHA-256 of "abc"', async () => {
    expect(await sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('canonicalJson sorts keys at every depth and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 }, e: undefined })).toBe(
      '{"a":{"c":3,"d":2},"b":1}'
    );
    expect(canonicalJson([2, { z: 1, a: 2 }])).toBe('[2,{"a":2,"z":1}]');
  });
});

describe('AuditLogDao (14-observability §6)', () => {
  let db: AuditFakeDb;
  let dao: AuditLogDao;

  beforeEach(() => {
    db = new AuditFakeDb();
    dao = new AuditLogDao(db, 'install-123');
  });

  it('appends with a genesis prev_hash derived from the install id', async () => {
    const record = await dao.append({ actor: 'user', action: 'consent.granted' });
    expect(record.prevHash).toBe(await sha256Hex('install-123'));
    expect(record.recordHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chains each record to the previous one and verifies', async () => {
    await dao.append({ actor: 'user', action: 'consent.granted', scope: 'backup' });
    await dao.append({ actor: 'ai-assistant', action: 'ai.tool.confirmed' });
    await dao.append({ actor: 'system', action: 'erasure.executed' });

    const records = await dao.list();
    expect(records[1]?.prevHash).toBe(records[0]?.recordHash);
    expect(records[2]?.prevHash).toBe(records[1]?.recordHash);
    expect(await dao.verifyChain()).toEqual({ valid: true, records: 3 });
  });

  it('detects tampering with a record field', async () => {
    await dao.append({ actor: 'user', action: 'consent.granted' });
    await dao.append({ actor: 'user', action: 'share.created' });
    db.rows[1] = { ...db.rows[1], action: 'share.revoked' };
    const result = await dao.verifyChain();
    expect(result.valid).toBe(false);
    expect(result.brokenAtSeq).toBe(2);
  });

  it('detects a deleted record (broken chain link)', async () => {
    await dao.append({ actor: 'user', action: 'a.one' });
    await dao.append({ actor: 'user', action: 'a.two' });
    await dao.append({ actor: 'user', action: 'a.three' });
    db.rows.splice(1, 1);
    const result = await dao.verifyChain();
    expect(result.valid).toBe(false);
  });

  it('exposes no update or delete methods (append-only by construction)', () => {
    const methods = Object.getOwnPropertyNames(AuditLogDao.prototype);
    expect(methods).not.toContain('update');
    expect(methods).not.toContain('delete');
    expect(methods).not.toContain('prune');
  });

  it('verifyChain on an empty table is valid', async () => {
    expect(await dao.verifyChain()).toEqual({ valid: true, records: 0 });
  });
});
