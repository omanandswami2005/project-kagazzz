import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import { SettingsDao } from '../settings.dao';

describe('SettingsDao', () => {
  let db: FakeDb;
  let dao: SettingsDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new SettingsDao(db);
  });

  it('get parses the stored JSON value', async () => {
    db.onQuery(/FROM app_settings/, [{ value: '{"mode":"dark"}' }]);
    expect(await dao.get<{ mode: string }>('theme')).toEqual({ mode: 'dark' });
  });

  it('get returns null for unset keys', async () => {
    expect(await dao.get('missing')).toBeNull();
  });

  it('set upserts the JSON-encoded value', async () => {
    await dao.set('theme', { mode: 'dark' });
    const call = db.calls[0];
    expect(call?.sql).toContain('ON CONFLICT(key) DO UPDATE');
    expect(call?.params?.[0]).toBe('theme');
    expect(call?.params?.[1]).toBe('{"mode":"dark"}');
  });

  it('remove deletes the key', async () => {
    expect(await dao.remove('theme')).toBe(1);
    expect(db.calls[0]?.sql).toBe('DELETE FROM app_settings WHERE key = ?');
  });
});
