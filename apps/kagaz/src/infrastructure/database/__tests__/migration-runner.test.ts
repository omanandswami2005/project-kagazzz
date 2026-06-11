import { describe, expect, it, vi } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import {
  getCurrentVersion,
  runMigrations,
  type Migration,
} from '../migration-runner';

function migration(version: number, name = `m${version}`): Migration {
  return {
    version,
    name,
    up: vi.fn(async () => undefined),
    down: vi.fn(async () => undefined),
  };
}

describe('getCurrentVersion', () => {
  it('creates the _migrations table and returns 0 on a pristine db', async () => {
    const db = new FakeDb();
    expect(await getCurrentVersion(db)).toBe(0);
    expect(db.allSql).toContain('CREATE TABLE IF NOT EXISTS _migrations');
  });

  it('returns the max applied version', async () => {
    const db = new FakeDb().onQuery(/MAX\(version\)/, [{ v: 3 }]);
    expect(await getCurrentVersion(db)).toBe(3);
  });
});

describe('runMigrations', () => {
  it('applies pending migrations in ascending order inside transactions', async () => {
    const db = new FakeDb();
    const m1 = migration(1);
    const m2 = migration(2);
    const applied = await runMigrations(db, [m2, m1]);

    expect(applied).toEqual([1, 2]);
    expect(m1.up).toHaveBeenCalledOnce();
    expect(m2.up).toHaveBeenCalledOnce();
    expect(db.transactions).toBe(2);
    expect(db.commits).toBe(2);
    const inserts = db.calls.filter((c) =>
      c.sql.includes('INSERT INTO _migrations')
    );
    expect(inserts.map((c) => c.params[0])).toEqual([1, 2]);
  });

  it('skips migrations at or below the current version', async () => {
    const db = new FakeDb().onQuery(/MAX\(version\)/, [{ v: 1 }]);
    const m1 = migration(1);
    const m2 = migration(2);
    const applied = await runMigrations(db, [m1, m2]);

    expect(applied).toEqual([2]);
    expect(m1.up).not.toHaveBeenCalled();
    expect(m2.up).toHaveBeenCalledOnce();
  });

  it('notifies onApplied per migration', async () => {
    const db = new FakeDb();
    const seen: number[] = [];
    await runMigrations(db, [migration(1)], (m) => seen.push(m.version));
    expect(seen).toEqual([1]);
  });

  it('rolls back and rethrows when a migration fails', async () => {
    const db = new FakeDb();
    const bad: Migration = {
      version: 1,
      name: 'broken',
      up: async () => {
        throw new Error('boom');
      },
      down: async () => undefined,
    };
    await expect(runMigrations(db, [bad])).rejects.toThrow(
      'Migration 1 (broken) failed'
    );
    expect(db.rollbacks).toBe(1);
    expect(db.commits).toBe(0);
  });

  it('rejects duplicate versions', async () => {
    const db = new FakeDb();
    await expect(
      runMigrations(db, [migration(1, 'a'), migration(1, 'b')])
    ).rejects.toThrow('Duplicate migration version: 1');
  });
});
