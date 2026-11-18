/**
 * Structured pieces of a chat message, stored in `ai_messages.parts_json`
 * (migration 007): documents the user attached, result cards for documents a
 * tool created, assistant forms, and the answers to them. DB content is
 * validated on the way out — a corrupt or hand-edited row degrades to a plain
 * text message instead of crashing the chat.
 */
import { z } from 'zod';
import { askUserSchema } from './ask-user';

export const docRefSchema = z.object({ id: z.string(), name: z.string(), fileType: z.string() });
export type DocRef = z.infer<typeof docRefSchema>;

export const messagePartSchema = z.discriminatedUnion('type', [
  /** User message: documents attached to it. */
  z.object({ type: z.literal('attachments'), documents: z.array(docRefSchema) }),
  /** Tool-result message: documents a tool just created. */
  z.object({ type: z.literal('documents'), documents: z.array(docRefSchema) }),
  /** Tool-call message: one tool the assistant ran, shown as a chip. */
  z.object({
    type: z.literal('tool'),
    name: z.string(),
    ok: z.boolean(),
    error: z.string().optional(),
  }),
  /** Assistant message: a form the user should fill in. */
  z.object({ type: z.literal('form'), formId: z.string(), spec: askUserSchema }),
  /** User message: the answer to a form (its readable text is the message content). */
  z.object({ type: z.literal('answer'), formId: z.string() }),
]);
export type MessagePart = z.infer<typeof messagePartSchema>;

/** Parses `parts_json`; anything malformed yields no parts. */
export function parseParts(partsJson: string | undefined | null): MessagePart[] {
  if (!partsJson) {
    return [];
  }
  try {
    const parsed = z.array(messagePartSchema).safeParse(JSON.parse(partsJson));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

export const serializeParts = (parts: MessagePart[]): string | undefined =>
  parts.length > 0 ? JSON.stringify(parts) : undefined;

/**
 * The text the model sees for a stored message — one function for live sends
 * and for replaying history, so both render attachments identically. Document
 * ids are included (metadata only) so the model never has to ask for one.
 */
export function toModelText(message: { content?: string; partsJson?: string }): string {
  const text = message.content ?? '';
  const attached = parseParts(message.partsJson).flatMap((p) =>
    p.type === 'attachments' ? p.documents : []
  );
  if (attached.length === 0) {
    return text;
  }
  const lines = attached.map((d) => `[Attached: "${d.name}" (id ${d.id}, ${d.fileType})]`);
  return [text, ...lines].filter(Boolean).join('\n');
}

/** Form ids the user has already answered, so a reloaded form card can't be submitted twice. */
export function answeredFormIds(messages: { partsJson?: string }[]): Set<string> {
  return new Set(
    messages.flatMap((m) =>
      parseParts(m.partsJson).flatMap((p) => (p.type === 'answer' ? [p.formId] : []))
    )
  );
}
