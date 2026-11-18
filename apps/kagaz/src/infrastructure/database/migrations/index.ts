/**
 * Migration registry — append-only, ascending versions.
 * V2 (shared_links, access log) and V3 (csc_services) tables ship as new
 * migrations with their versions, never by editing existing ones.
 */
import type { Migration } from '../migration-runner';
import { initialSchema } from './001-initial-schema';
import { addFts } from './002-add-fts';
import { addLogging } from './003-add-logging';
import { addLastAccessed } from './004-add-last-accessed';
import { addQuickReference } from './005-add-quick-reference';
import { addQuickReferenceSecurityFlag } from './006-add-quick-reference-security-flag';
import { addAiMessageParts } from './007-add-ai-message-parts';

/** All known migrations in ascending version order. */
export const migrations: Migration[] = [
  initialSchema,
  addFts,
  addLogging,
  addLastAccessed,
  addQuickReference,
  addQuickReferenceSecurityFlag,
  addAiMessageParts,
];
