/**
 * Minimal, dependency-free Markdown renderer for the in-app legal screens
 * (G1-5). Parses a bounded subset — headings, paragraphs, bullet lists, and
 * horizontal rules, with inline **bold** and [links](url) — straight into React
 * elements. It never injects HTML (no `dangerouslySetInnerHTML`), so there is no
 * XSS surface; unsupported markdown just renders as its literal text.
 */
import { Fragment, type ReactNode } from 'react';

/** Renders inline **bold** and [text](url); everything else is literal text. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on bold (**…**) or links ([text](url)), keeping the delimiters.
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(pattern);
  parts.forEach((part, i) => {
    const key = `${keyBase}-${i}`;
    const bold = /^\*\*([^*]+)\*\*$/.exec(part);
    if (bold) {
      nodes.push(<strong key={key}>{bold[1]}</strong>);
      return;
    }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      // Only http(s)/mailto get a real link; an unsafe scheme (javascript:,
      // data:, …) renders as plain text so there is no XSS surface.
      if (/^(https?:|mailto:)/i.test(link[2])) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>
        );
      } else {
        nodes.push(<Fragment key={key}>{link[1]}</Fragment>);
      }
      return;
    }
    if (part) {
      nodes.push(<Fragment key={key}>{part}</Fragment>);
    }
  });
  return nodes;
}

/** Props for {@link MarkdownView}. */
export interface MarkdownViewProps {
  /** Raw Markdown source. */
  source: string;
  /** When set and the text has 4+ sections, a contents list (this label as
   * its heading) jumps to each `##` section (audit LG-2). */
  tocLabel?: string;
}

/** Minimum number of sections before a contents list is worth showing. */
const TOC_MIN_SECTIONS = 4;

/** Renders a bounded Markdown subset as React elements. */
export function MarkdownView({ source, tocLabel }: MarkdownViewProps): ReactNode {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;
  const sections: { id: string; title: string }[] = [];

  const flushList = (): void => {
    if (list.length > 0) {
      const items = list;
      blocks.push(
        <ul className="kg-md__list" key={`ul-${key++}`}>
          {items.map((item, i) => (
            <li key={i}>{renderInline(item, `li-${key}-${i}`)}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith('<!--')) {
      continue; // skip HTML comments
    }
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    if (bullet) {
      list.push(bullet[1]);
      continue;
    }
    flushList();

    if (trimmed === '') {
      continue;
    }
    if (/^---+$/.test(trimmed)) {
      blocks.push(<hr className="kg-md__hr" key={`hr-${key++}`} />);
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1].length, 3);
      const Tag = (['h2', 'h2', 'h3'] as const)[level - 1];
      const id = level === 2 ? `md-section-${sections.length}` : undefined;
      if (id) sections.push({ id, title: heading[2] });
      blocks.push(
        <Tag className={`kg-md__h${level}`} key={`h-${key++}`} id={id}>
          {renderInline(heading[2], `h-${key}`)}
        </Tag>
      );
      continue;
    }
    blocks.push(
      <p className="kg-md__p" key={`p-${key++}`}>
        {renderInline(trimmed, `p-${key}`)}
      </p>
    );
  }
  flushList();

  const toc =
    tocLabel && sections.length >= TOC_MIN_SECTIONS ? (
      <nav className="kg-md__toc" aria-label={tocLabel} key="toc">
        <h2 className="kg-md__toc-title">{tocLabel}</h2>
        <ol>
          {sections.map((section) => (
            <li key={section.id}>
              {/* Buttons, not #hash links: the router owns the URL. */}
              <button
                type="button"
                className="kg-md__toc-link"
                onClick={() =>
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {section.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    ) : null;

  return (
    <div className="kg-md">
      {/* The title (# line) comes first, then the contents, then the text. */}
      {toc ? [blocks[0], toc, ...blocks.slice(1)] : blocks}
    </div>
  );
}
