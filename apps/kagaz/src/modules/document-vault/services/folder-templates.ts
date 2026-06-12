/**
 * Starter folder templates (02-document-vault-module.md §Default Folder
 * Templates). Offered on first launch so a new user starts organized
 * (F-30). Names are i18n keys resolved at creation time; colors come
 * from the design palette.
 */
import type { IconName } from '@kagaz/ui';

/** One starter folder definition. */
export interface FolderTemplate {
  /** i18n key (documents namespace) for the folder name. */
  labelKey: string;
  icon: IconName;
  color: string;
}

/** The default starter set (spec §Default Folder Templates). */
export const FOLDER_TEMPLATES = [
  { labelKey: 'templates.identity', icon: 'Lock', color: '#3b82f6' },
  { labelKey: 'templates.education', icon: 'GraduationCap', color: '#f59e0b' },
  { labelKey: 'templates.financial', icon: 'Folder', color: '#10b981' },
  { labelKey: 'templates.health', icon: 'Heart', color: '#ef4444' },
  { labelKey: 'templates.property', icon: 'Home', color: '#8b5cf6' },
  { labelKey: 'templates.employment', icon: 'FileText', color: '#6366f1' },
  { labelKey: 'templates.misc', icon: 'File', color: '#6b7280' },
] as const satisfies readonly FolderTemplate[];
