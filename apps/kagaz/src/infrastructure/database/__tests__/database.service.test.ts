import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  return { dbConn, sqliteApi };
});

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

  it('execute passes through without implicit transaction', async () => {
    const adapter = new SqliteDbAdapter(rawConnection());
    await adapter.execute('CREATE TABLE t (a)');
    expect(mocks.dbConn.execute).toHaveBeenCalledWith('CREATE TABLE t (a)', false);
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

  it('initializes the web store on the web platform', async () => {
    mockedGetPlatform.mockReturnValue('web');
    await openDatabase([]);
    expect(mocks.sqliteApi.initWebStore).toHaveBeenCalledOnce();
  });
});
