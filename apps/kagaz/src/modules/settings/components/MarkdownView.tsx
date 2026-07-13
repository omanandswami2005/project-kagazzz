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
}

/** Renders a bounded Markdown subset as React elements. */
export function MarkdownView({ source }: MarkdownViewProps): ReactNode {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let key = 0;

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
      blocks.push(
        <Tag className={`kg-md__h${level}`} key={`h-${key++}`}>
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

  return <div className="kg-md">{blocks}</div>;
}
