/**
 * Document names in chat text as tappable links (smart UI plan §5). The chat
 * screen provides the candidate documents and what a tap does through
 * {@link DocLinkProvider}; {@link LinkedText} (used by the Markdown renderer
 * for every plain-text run) turns matching names into {@link DocumentLink}s.
 * Outside a provider it renders the text unchanged.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { splitByDocNames } from '../services/doc-mentions';

interface DocLinkContextValue {
  documents: readonly DocumentEntity[];
  onOpen: (document: DocumentEntity) => void;
}

const DocLinkContext = createContext<DocLinkContextValue | null>(null);

/** Makes document names in the subtree tappable. */
export function DocLinkProvider({
  documents,
  onOpen,
  children,
}: DocLinkContextValue & { children: ReactNode }): ReactNode {
  const value = useMemo(() => ({ documents, onOpen }), [documents, onOpen]);
  return <DocLinkContext.Provider value={value}>{children}</DocLinkContext.Provider>;
}

/** One document name as a link button. */
export function DocumentLink({
  document,
  children,
  onOpen,
}: {
  document: DocumentEntity;
  children?: ReactNode;
  onOpen: (document: DocumentEntity) => void;
}): ReactNode {
  return (
    <button
      type="button"
      className="kg-doc-link"
      onClick={() => onOpen(document)}
      data-agent-id={`ai.chat.doc-link-${document.id}`}
    >
      {children ?? document.name}
    </button>
  );
}

/** Plain text with any known document names turned into links. */
export function LinkedText({ text }: { text: string }): ReactNode {
  const ctx = useContext(DocLinkContext);
  if (!ctx) {
    return text;
  }
  return splitByDocNames(text, ctx.documents).map((segment, i) =>
    typeof segment === 'string' ? (
      segment
    ) : (
      <DocumentLink key={i} document={segment.doc} onOpen={ctx.onOpen}>
        {segment.text}
      </DocumentLink>
    )
  );
}
