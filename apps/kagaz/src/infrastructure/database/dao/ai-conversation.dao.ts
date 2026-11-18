/**
 * ai_conversations + ai_messages DAO
 * (docs/architecture/09-database-design.md §4.6–§4.7).
 *
 * [SEC] Conversation content is sensitive (10-security §5): it lives only
 * in the encrypted database and must never be logged.
 */
import type { DbConnection, SqlRow } from '../connection';
import type {
  AiConversationEntity,
  AiMessageEntity,
  AiMessageRole,
} from '../types';
import {
  asBool,
  asOptionalString,
  asString,
  newId,
  nowIso,
} from './row-mapping';

function mapConversation(row: SqlRow): AiConversationEntity {
  return {
    id: asString(row, 'id'),
    title: asOptionalString(row, 'title'),
    createdAt: asString(row, 'created_at'),
    updatedAt: asString(row, 'updated_at'),
    isPinned: asBool(row, 'is_pinned'),
    activeSkills: asOptionalString(row, 'active_skills'),
  };
}

function mapMessage(row: SqlRow): AiMessageEntity {
  return {
    id: asString(row, 'id'),
    conversationId: asString(row, 'conversation_id'),
    role: asString(row, 'role') as AiMessageRole,
    content: asOptionalString(row, 'content'),
    toolCallsJson: asOptionalString(row, 'tool_calls_json'),
    toolCallId: asOptionalString(row, 'tool_call_id'),
    partsJson: asOptionalString(row, 'parts_json'),
    createdAt: asString(row, 'created_at'),
  };
}

/** Typed access to AI chat persistence. */
export class AiConversationDao {
  constructor(private readonly db: DbConnection) {}

  /** Returns a conversation by id, or null. */
  async findById(id: string): Promise<AiConversationEntity | null> {
    const rows = await this.db.query(
      'SELECT * FROM ai_conversations WHERE id = ?',
      [id]
    );
    return rows[0] ? mapConversation(rows[0]) : null;
  }

  /** Lists conversations, pinned first then most recently updated. */
  async findAll(): Promise<AiConversationEntity[]> {
    const rows = await this.db.query(
      'SELECT * FROM ai_conversations ORDER BY is_pinned DESC, updated_at DESC'
    );
    return rows.map(mapConversation);
  }

  /** Creates a conversation (title may be set later from the first turn). */
  async create(title?: string): Promise<AiConversationEntity> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO ai_conversations (id, title, created_at, updated_at,
        is_pinned) VALUES (?, ?, ?, ?, 0)`,
      [id, title ?? null, now, now]
    );
    const created = await this.findById(id);
    if (!created) {
      throw new Error(`ai_conversations insert for ${id} did not persist`);
    }
    return created;
  }

  /** Renames a conversation. */
  async rename(id: string, title: string): Promise<number> {
    const result = await this.db.run(
      'UPDATE ai_conversations SET title = ?, updated_at = ? WHERE id = ?',
      [title, nowIso(), id]
    );
    return result.changes;
  }

  /** Pins/unpins a conversation. */
  async setPinned(id: string, pinned: boolean): Promise<number> {
    const result = await this.db.run(
      'UPDATE ai_conversations SET is_pinned = ?, updated_at = ? WHERE id = ?',
      [pinned ? 1 : 0, nowIso(), id]
    );
    return result.changes;
  }

  /** Deletes a conversation; its messages cascade. */
  async delete(id: string): Promise<number> {
    const result = await this.db.run(
      'DELETE FROM ai_conversations WHERE id = ?',
      [id]
    );
    return result.changes;
  }

  /** Appends a message and touches the conversation's updated_at. */
  async appendMessage(
    message: Omit<AiMessageEntity, 'id' | 'createdAt'>
  ): Promise<AiMessageEntity> {
    const id = newId();
    const now = nowIso();
    await this.db.run(
      `INSERT INTO ai_messages (id, conversation_id, role, content,
        tool_calls_json, tool_call_id, parts_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        message.conversationId,
        message.role,
        message.content ?? null,
        message.toolCallsJson ?? null,
        message.toolCallId ?? null,
        message.partsJson ?? null,
        now,
      ]
    );
    await this.db.run(
      'UPDATE ai_conversations SET updated_at = ? WHERE id = ?',
      [now, message.conversationId]
    );
    const rows = await this.db.query('SELECT * FROM ai_messages WHERE id = ?', [
      id,
    ]);
    if (!rows[0]) {
      throw new Error(`ai_messages insert for ${id} did not persist`);
    }
    return mapMessage(rows[0]);
  }

  /** Remembers which skills are loaded in a conversation (migration 007). */
  async setActiveSkills(id: string, skills: string[]): Promise<number> {
    const result = await this.db.run('UPDATE ai_conversations SET active_skills = ? WHERE id = ?', [
      JSON.stringify(skills),
      id,
    ]);
    return result.changes;
  }

  /** Lists a conversation's messages in chronological order. */
  async findMessages(conversationId: string): Promise<AiMessageEntity[]> {
    const rows = await this.db.query(
      `SELECT * FROM ai_messages WHERE conversation_id = ?
       ORDER BY created_at, id`,
      [conversationId]
    );
    return rows.map(mapMessage);
  }
}
