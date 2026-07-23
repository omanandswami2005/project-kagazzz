/**
 * Virtualized document list (UX pass, 2026-07-23, user-requested
 * "vertualizaation as optimization"). Renders only the rows near the
 * viewport instead of every `DocumentListItem` at once — matters once a
 * vault holds hundreds of documents. Row-based (`@tanstack/react-virtual`
 * is 1D): grid mode groups documents into rows of the *live* column count
 * (`useGridColumns` — the CSS is a responsive `auto-fill` grid, not a fixed
 * column count, so this has to track real rendered width, not guess it);
 * list/compact are naturally 1 column.
 *
 * Shares `IonContent`'s own scroll element (via `scrollElement`, resolved
 * by the caller through `getScrollElement()`) rather than giving the list
 * its own nested scroll container — keeps the page's existing "everything
 * scrolls together" feel and native Ionic scroll physics. Positioning
 * within that shared scroll region (which has other content — search bar,
 * Recent strip, folder bar, filter controls — above the list) uses
 * `scrollMargin`, tanstack-virtual's supported mechanism for exactly this;
 * measured off this component's own root offset and re-measured whenever
 * the document count or view mode changes (both can change what's above
 * the list, e.g. the controls row appearing/disappearing).
 */
import { useVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { SwipeActionKind } from '@/core/gestures';
import type { DocumentEntity, TagEntity } from '@/infrastructure/database/types';
import { useGridColumns } from '../hooks/useGridColumns';
import { DocumentListItem } from './DocumentListItem';

/** Estimated row height per view mode (re-measured per row via `measureElement`,
 * so this only affects the very first paint, not final layout). */
const ROW_HEIGHT_ESTIMATE: Record<string, number> = {
  grid: 190,
  compact: 56,
  list: 96,
};

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 1) {
    return items.map((item) => [item]);
  }
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

/** Props for {@link VirtualDocumentList}. */
export interface VirtualDocumentListProps {
  documents: DocumentEntity[];
  viewMode: 'list' | 'grid' | 'compact';
  tagsByDocument: Map<string, TagEntity[]>;
  /** The IonContent scroll element (`await ionContentRef.current.getScrollElement()`).
   * While null (still resolving, or unavailable in this environment — e.g.
   * jsdom, which never upgrades Ionic's web components), renders the plain
   * non-virtualized list instead of nothing: a real document vault must
   * never render an empty list just because a native API is slow, and this
   * doubles as the graceful test-environment fallback. */
  scrollElement: HTMLElement | null;
  onOpen: (document: DocumentEntity) => void;
  onToggleFavorite: (document: DocumentEntity) => void;
  onMore: (document: DocumentEntity) => void;
  selectionMode: boolean;
  selectedIds: string[];
  onToggleSelect: (document: DocumentEntity) => void;
  onLongPress: (document: DocumentEntity) => void;
  agentId: string;
  agentState?: string;
  /** F-88: action fired on a committed swipe-left; omit to disable. */
  swipeLeftAction?: SwipeActionKind;
  /** F-88: action fired on a committed swipe-right; omit to disable. */
  swipeRightAction?: SwipeActionKind;
  /** Handles a committed swipe action. Required when either side is set. */
  onSwipeAction?: (
    document: DocumentEntity,
    kind: Exclude<SwipeActionKind, 'none'>
  ) => void;
}

/** Windowed replacement for a plain `documents.map(...)` list/grid. */
export function VirtualDocumentList({
  documents,
  viewMode,
  tagsByDocument,
  scrollElement,
  onOpen,
  onToggleFavorite,
  onMore,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onLongPress,
  agentId,
  agentState,
  swipeLeftAction,
  swipeRightAction,
  onSwipeAction,
}: VirtualDocumentListProps): ReactNode {
  const containerRef = useRef<HTMLUListElement>(null);
  const isGrid = viewMode === 'grid';
  const columns = useGridColumns(containerRef, isGrid);
  const rows = useMemo(() => chunk(documents, columns), [documents, columns]);

  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    if (containerRef.current) {
      setScrollMargin(containerRef.current.offsetTop);
    }
    // Re-measure whenever content that could sit above this list changes
    // size (Recent strip collapse/expand, filter controls appearing, the
    // document count itself affecting the controls row).
  }, [documents.length, viewMode]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ROW_HEIGHT_ESTIMATE[viewMode] ?? 96,
    overscan: 6,
    scrollMargin,
  });

  const renderItem = (document: DocumentEntity): ReactNode => (
    <DocumentListItem
      key={document.id}
      document={document}
      tags={tagsByDocument.get(document.id) ?? []}
      onOpen={onOpen}
      onToggleFavorite={onToggleFavorite}
      onMore={onMore}
      selectionMode={selectionMode}
      selected={selectedIds.includes(document.id)}
      onToggleSelect={onToggleSelect}
      onLongPress={onLongPress}
      swipeLeftAction={swipeLeftAction}
      swipeRightAction={swipeRightAction}
      onSwipeAction={onSwipeAction}
    />
  );

  if (!scrollElement) {
    return (
      <ul
        className={`kg-vault__list kg-vault__list--${viewMode}`}
        data-agent-id={agentId}
        data-agent-state={agentState}
      >
        {documents.map(renderItem)}
      </ul>
    );
  }

  return (
    <ul
      ref={containerRef}
      className="kg-vault__virtual-outer"
      data-agent-id={agentId}
      data-agent-state={agentState}
      style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => (
        <li
          key={virtualRow.key}
          ref={rowVirtualizer.measureElement}
          data-index={virtualRow.index}
          className={`kg-vault__virtual-row kg-vault__virtual-row--${viewMode}`}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualRow.start - scrollMargin}px)`,
          }}
        >
          <ul className={`kg-vault__list kg-vault__list--${viewMode}`}>
            {(rows[virtualRow.index] ?? []).map(renderItem)}
          </ul>
        </li>
      ))}
    </ul>
  );
}
