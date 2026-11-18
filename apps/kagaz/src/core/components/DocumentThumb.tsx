/**
 * A document's visual: its cached thumbnail, or a file-type icon when there is
 * none, inside a page-shaped box. Shared by the Recent strip and the PDF Tools
 * picker so documents look the same everywhere they are chosen.
 *
 * [SEC] 10-security §3.1: a locked document's thumbnail is blurred and covered
 * by a lock icon, never shown plainly.
 */
import type { ReactNode } from 'react';
import { Icon, type IconName } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useThumbnail } from '@/core/hooks/useThumbnail';
import './document-thumb.css';

/** File-type fallback icons, keyed by the stored (lowercase) extension. */
export const DOCUMENT_TYPE_ICONS: Partial<Record<string, IconName>> = {
  pdf: 'FileText',
  jpg: 'FileImage',
  jpeg: 'FileImage',
  png: 'FileImage',
  heic: 'FileImage',
  webp: 'FileImage',
};

/** Props for {@link DocumentThumb}. */
export interface DocumentThumbProps {
  document: Pick<DocumentEntity, 'thumbnailPath' | 'fileType' | 'isLocked'>;
  /** Fallback/lock icon size in px. */
  iconSize?: number;
  /** Extra class for the box (sizing comes from the caller). */
  className?: string;
  agentId?: string;
}

/** Page-shaped thumbnail box (fills its parent's width, 3:4). */
export function DocumentThumb({
  document,
  iconSize = 32,
  className,
  agentId,
}: DocumentThumbProps): ReactNode {
  const url = useThumbnail(document.thumbnailPath);
  const classes = ['kg-doc-thumb', className].filter(Boolean).join(' ');
  if (document.isLocked) {
    return (
      <span className={classes} data-agent-id={agentId} data-locked="true">
        {url && <img className="kg-doc-thumb__img kg-doc-thumb__img--locked" src={url} alt="" loading="lazy" />}
        <Icon name="Lock" size={iconSize} />
      </span>
    );
  }
  return (
    <span className={classes} data-agent-id={agentId}>
      {url ? (
        <img className="kg-doc-thumb__img" src={url} alt="" loading="lazy" />
      ) : (
        <Icon name={DOCUMENT_TYPE_ICONS[document.fileType.toLowerCase()] ?? 'File'} size={iconSize} />
      )}
    </span>
  );
}
