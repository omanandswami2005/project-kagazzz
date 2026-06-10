import { beforeEach, describe, expect, it } from 'vitest';
import { FakeDb } from '@/test/fake-db';
import type { SqlRow } from '../../connection';
import { AiConversationDao } from '../ai-conversation.dao';

function conversationRow(overrides: SqlRow = {}): SqlRow {
  return {
    id: 'c-1',
    title: 'Merge my PDFs',
    created_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    is_pinned: 0,
    ...overrides,
  };
}

function messageRow(overrides: SqlRow = {}): SqlRow {
  return {
    id: 'm-1',
    conversation_id: 'c-1',
    role: 'user',
    content: 'merge these',
    tool_calls_json: null,
    tool_call_id: null,
    created_at: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('AiConversationDao', () => {
  let db: FakeDb;
  let dao: AiConversationDao;

  beforeEach(() => {
    db = new FakeDb();
    dao = new AiConversationDao(db);
  });

  it('findById maps the row, null when missing', async () => {
    db.onQuery(/FROM ai_conversations WHERE id/, [conversationRow()]);
    expect(await dao.findById('c-1')).toMatchObject({
      id: 'c-1',
      title: 'Merge my PDFs',
      isPinned: false,
    });
    expect(await new AiConversationDao(new FakeDb()).findById('x')).toBeNull();
  });

  it('findAll orders pinned first, then recency', async () => {
    await dao.findAll();
    expect(db.calls[0]?.sql).toContain(
      'ORDER BY is_pinned DESC, updated_at DESC'
    );
  });

  it('create inserts an unpinned conversation', async () => {
    db.onQuery(/FROM ai_conversations WHERE id/, [conversationRow()]);
    const conv = await dao.create('Merge my PDFs');
    expect(conv.id).toBe('c-1');
    const insert = db.calls.find((c) =>
      c.sql.includes('INSERT INTO ai_conversations')
    );
    expect(insert?.params?.[1]).toBe('Merge my PDFs');
  });

  it('create throws if the row cannot be read back', async () => {
    await expect(dao.create()).rejects.toThrow('did not persist');
  });

  it('rename and setPinned touch updated_at', async () => {
    await dao.rename('c-1', 'New title');
    expect(db.calls[0]?.sql).toContain('SET title = ?, updated_at = ?');
    await dao.setPinned('c-1', true);
    expect(db.calls[1]?.params?.[0]).toBe(1);
  });

  it('delete removes the conversation', async () => {
    expect(await dao.delete('c-1')).toBe(1);
  });

  it('appendMessage inserts and touches the conversation', async () => {
    db.onQuery(/FROM ai_messages WHERE id/, [messageRow()]);
    const message = await dao.appendMessage({
      conversationId: 'c-1',
      role: 'user',
      content: 'merge these',
    });
    expect(message.role).toBe('user');
    const update = db.calls.find(
      (c) => c.kind === 'run' && c.sql.includes('UPDATE ai_conversations')
    );
    expect(update?.params?.[1]).toBe('c-1');
  });

  it('appendMessage throws if the row cannot be read back', async () => {
    await expect(
      dao.appendMessage({ conversationId: 'c-1', role: 'assistant' })
    ).rejects.toThrow('did not persist');
  });

  it('findMessages lists chronologically', async () => {
    db.onQuery(/FROM ai_messages WHERE conversation_id/, [messageRow()]);
    const messages = await dao.findMessages('c-1');
    expect(messages).toHaveLength(1);
    expect(db.calls[0]?.sql).toContain('ORDER BY created_at, id');
  });
});
