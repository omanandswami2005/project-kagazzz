import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import type { SQLiteDBConnection } from '@capacitor-community/sqlite';
import { openDatabase, SqliteDbAdapter, DATABASE_NAME } from '../database.service';
import type { Migration } from '../migration-runner';

const mocks = vi.hoisted(() => {
  const dbConn = {
    query: vi.fn(async (_sql: string, _params?: unknown[]) => ({
      values: [] as Record<string, unknown>[],
    })),
    run: vi.fn(async (_sql: string, _params?: unknown[], _tx?: boolean) => ({
      changes: { changes: 1, lastId: 1 },
    })),
    execute: vi.fn(async (_sql: string, _tx?: boolean) => ({
      changes: { changes: 0 },
    })),
    open: vi.fn(async () => undefined),
  };
  const sqliteApi = {
    initWebStore: vi.fn(async () => undefined),
    isSecretStored: vi.fn(async () => ({ result: false })),
    setEncryptionSecret: vi.fn(async () => undefined),
    createConnection: vi.fn(async () => dbConn),
  };
  const demo = { value: false };
  const mountWebStore = vi.fn(async () => undefined);
  return { dbConn, sqliteApi, demo, mountWebStore };
});

vi.mock('../web-store', () => ({
  isWebDemo: () => mocks.demo.value,
  mountWebStore: mocks.mountWebStore,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: vi.fn(() => 'android') },
}));

vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: {},
  // Regular function so `new SQLiteConnection(...)` works: a constructor
  // returning an object yields that object.
  SQLiteConnection: vi.fn(function SQLiteConnection() {
    return mocks.sqliteApi;
  }),
}));

vi.mock('../encryption-key.provider', () => ({
  getOrCreateDbEncryptionKey: vi.fn(async () => 'ab'.repeat(32)),
}));

const mockedGetPlatform = vi.mocked(Capacitor.getPlatform);

function rawConnection(): SQLiteDBConnection {
  return mocks.dbConn as unknown as SQLiteDBConnection;
}

describe('SqliteDbAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('browser demo persistence (persistWhenIdle)', () => {
    afterEach(() => vi.useRealTimers());

    it('flushes once ~400 ms after the last write, and not at all without a hook', async () => {
      vi.useFakeTimers();
      const persist = vi.fn().mockResolvedValue(undefined);
      const adapter = new SqliteDbAdapter(rawConnection(), persist);
      await adapter.run('INSERT 1');
      await vi.advanceTimersByTimeAsync(300);
      await adapter.run('INSERT 2'); // resets the debounce
      await vi.advanceTimersByTimeAsync(300);
      expect(persist).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      expect(persist).toHaveBeenCalledOnce();

      const plain = new SqliteDbAdapter(rawConnection());
      await plain.run('INSERT 3');
      await vi.advanceTimersByTimeAsync(2000);
      expect(persist).toHaveBeenCalledOnce();
    });

    it('never flushes while a transaction is open (sql.js export() would end it)', async () => {
      vi.useFakeTimers();
      const persist = vi.fn().mockResolvedValue(undefined);
      const adapter = new SqliteDbAdapter(rawConnection(), persist);
      await adapter.transaction(async (tx) => {
        await tx.run('INSERT inside');
        await vi.advanceTimersByTimeAsync(1500); // far past the debounce, still inside the tx
        expect(persist).not.toHaveBeenCalled();
      });
      await vi.advanceTimersByTimeAsync(500);
      expect(persist).toHaveBeenCalledOnce();
    });
  });

  it('query unwraps result.values', async () => {
    mocks.dbConn.query.mockResolvedValueOnce({ values: [{ a: 1 }] });
    const adapter = new SqliteDbAdapter(rawConnection());
    expect(await adapter.query('SELECT 1', [])).toEqual([{ a: 1 }]);
  });

  it('run disables the plugin transaction and unwraps changes', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    const result = await adapter.run('UPDATE x SET a = ?', [1]);
    expect(result).toEqual({ changes: 1 });
    expect(mocks.dbConn.run).toHaveBeenCalledWith('UPDATE x SET a = ?', [1], false);
  });

  it('execute runs without implicit transaction and normalizes a trailing newline', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    await adapter.execute('CREATE TABLE t (a)');
    // Trailing newline appended so the native ";\n" splitter tokenizes a
    // final `END;` correctly (see SqliteDbAdapter.execute).
    expect(mocks.dbConn.execute).toHaveBeenCalledWith('CREATE TABLE t (a)\n', false);
  });

  it('execute leaves an already-newline-terminated batch unchanged', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    await adapter.execute('CREATE TRIGGER t ... END;\n');
    expect(mocks.dbConn.execute).toHaveBeenCalledWith(
      'CREATE TRIGGER t ... END;\n',
      false
    );
  });

  it('transaction commits on success', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    const out = await adapter.transaction(async () => 'ok');
    expect(out).toBe('ok');
    const statements = mocks.dbConn.execute.mock.calls.map((c) => c[0]);
    expect(statements).toContain('BEGIN TRANSACTION;');
    expect(statements).toContain('COMMIT;');
  });

  it('transaction rolls back and rethrows on failure', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    await expect(
      adapter.transaction(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    const statements = mocks.dbConn.execute.mock.calls.map((c) => c[0]);
    expect(statements).toContain('ROLLBACK;');
  });
});

describe('openDatabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sqliteApi.isSecretStored.mockResolvedValue({ result: false });
    mockedGetPlatform.mockReturnValue('android');
  });

  it('opens an encrypted connection and runs migrations', async () => {
    const applied: number[] = [];
    const probe: Migration = {
      version: 1,
      name: 'probe',
      up: async () => undefined,
      down: async () => undefined,
    };
    await openDatabase([probe], (m) => applied.push(m.version));

    expect(mocks.sqliteApi.createConnection).toHaveBeenCalledWith(
      DATABASE_NAME,
      true,
      'secret',
      1,
      false
    );
    expect(mocks.dbConn.open).toHaveBeenCalledOnce();
    expect(applied).toEqual([1]);
    expect(mocks.sqliteApi.initWebStore).not.toHaveBeenCalled();
  });

  it('bug-audit fix: enables foreign-key enforcement before running migrations', async () => {
    await openDatabase([]);
    const statements = mocks.dbConn.execute.mock.calls.map((c) => c[0]);
    expect(statements).toContain('PRAGMA foreign_keys = ON;\n');
  });

  it('stores the encryption secret only when not already stored', async () => {
    await openDatabase([]);
    expect(mocks.sqliteApi.setEncryptionSecret).toHaveBeenCalledWith(
      'ab'.repeat(32)
    );

    vi.clearAllMocks();
    mocks.sqliteApi.isSecretStored.mockResolvedValue({ result: true });
    await openDatabase([]);
    expect(mocks.sqliteApi.setEncryptionSecret).not.toHaveBeenCalled();
  });

  it('web (demo build): mounts the store, skips the secret, and opens an UNENCRYPTED connection', async () => {
    mockedGetPlatform.mockReturnValue('web');
    mocks.demo.value = true;
    await openDatabase([]);

    expect(mocks.mountWebStore).toHaveBeenCalledOnce();
    expect(mocks.sqliteApi.initWebStore).toHaveBeenCalledOnce();
    expect(mocks.sqliteApi.isSecretStored).not.toHaveBeenCalled();
    expect(mocks.sqliteApi.createConnection).toHaveBeenCalledWith(DATABASE_NAME, false, 'no-encryption', 1, false);
  });

  it('web (normal build): refuses to open an unencrypted database', async () => {
    mockedGetPlatform.mockReturnValue('web');
    mocks.demo.value = false;
    await expect(openDatabase([])).rejects.toThrow('only available in demo builds');
    expect(mocks.sqliteApi.createConnection).not.toHaveBeenCalled();
  });
});
