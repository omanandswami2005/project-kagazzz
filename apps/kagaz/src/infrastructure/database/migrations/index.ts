/**
 * Migration registry — append-only, ascending versions.
 * V2 (shared_links, access log) and V3 (csc_services) tables ship as new
 * migrations with their versions, never by editing existing ones.
 */
import type { Migration } from '../migration-runner';
import { initialSchema } from './001-initial-schema';
import { addFts } from './002-add-fts';

/** All known migrations in ascending version order. */
export const migrations: Migration[] = [initialSchema, addFts];
