/**
 * A small, safe Markdown renderer for chat bubbles. It builds React elements
 * from text — it never produces an HTML string — so model output (untrusted)
 * cannot inject markup or scripts. Supported: paragraphs with soft line
 * breaks, **bold**, *italic* / _italic_, `code`, fenced code blocks, # headings
 * (shown bold), bullet and numbered lists, > quotes and [links](https://…) (http, https and
 * mailto only). Anything else, including unfinished syntax while a reply is
 * still streaming, is shown literally.
 */
import type { ReactNode } from 'react';

const SAFE_URL = /^(https?:\/\/|mailto:)/i;
// code | bold | italic | link — earliest match wins
const INLINE = /(`[^`\n]+`)|(\*\*|__)(?=\S)([\s\S]*?\S)\2|(\*|_)(?=\S)([\s\S]*?\S)\4|\[([^\]\n]+)\]\(([^)\s]+)\)/;

const isWord = (ch: string | undefined): boolean => ch !== undefined && /[A-Za-z0-9]/.test(ch);

/** Inline formatting for one line of text. */
export function renderInline(text: string, keyPrefix = 'i'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push(rest);
      break;
    }
    const start = match.index;
    const end = start + match[0].length;
    const marker = match[2] ?? match[4];
    // `_` is only emphasis at word edges, so snake_case_names stay untouched.
    const intraword = marker?.startsWith('_') && (isWord(rest[start - 1]) || isWord(rest[end]));
    if (intraword) {
      nodes.push(rest.slice(0, end));
      rest = rest.slice(end);
      continue;
    }
    if (start > 0) {
      nodes.push(rest.slice(0, start));
    }
    const key = `${keyPrefix}-${n++}`;
    if (match[1]) {
      nodes.push(<code key={key}>{match[1].slice(1, -1)}</code>);
    } else if (match[2]) {
      nodes.push(<strong key={key}>{renderInline(match[3], key)}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={key}>{renderInline(match[5], key)}</em>);
    } else if (SAFE_URL.test(match[7])) {
      nodes.push(
        <a key={key} href={match[7]} target="_blank" rel="noopener noreferrer">
          {renderInline(match[6], key)}
        </a>
      );
    } else {
      nodes.push(match[0]); // unsafe link target (e.g. javascript:) stays as plain text
    }
    rest = rest.slice(end);
  }
  return nodes;
}

const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s+(.*)$/;
const HEADING = /^#{1,6}\s+(.*)$/;
const FENCE = /^\s*```/;

function paragraph(lines: string[], key: string): ReactNode {
  return (
    <p key={key}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {renderInline(line, `${key}-${i}`)}
        </span>
      ))}
    </p>
  );
}

/** Block structure for a whole message. */
export function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let b = 0;
  while (i < lines.length) {
    const line = lines[i];
    const key = `b${b++}`;
    if (!line.trim()) {
      i++;
    } else if (FENCE.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !FENCE.test(lines[i])) {
        code.push(lines[i++]);
      }
      i++; // closing fence (or end of a still-streaming block)
      blocks.push(
        <pre key={key}>
          <code>{code.join('\n')}</code>
        </pre>
      );
    } else if (HEADING.test(line)) {
      blocks.push(
        <p key={key} className="kg-md__heading">
          <strong>{renderInline(HEADING.exec(line)![1], key)}</strong>
        </p>
      );
      i++;
    } else if (LIST_ITEM.test(line)) {
      const ordered = /\d/.test(LIST_ITEM.exec(line)![1]);
      const items: string[] = [];
      while (i < lines.length && LIST_ITEM.test(lines[i])) {
        items.push(LIST_ITEM.exec(lines[i++])![2]);
      }
      const children = items.map((item, k) => <li key={k}>{renderInline(item, `${key}-${k}`)}</li>);
      blocks.push(ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>);
    } else if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      }
      blocks.push(<blockquote key={key}>{paragraph(quote, `${key}q`)}</blockquote>);
    } else {
      const para: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !FENCE.test(lines[i]) &&
        !HEADING.test(lines[i]) &&
        !LIST_ITEM.test(lines[i]) &&
        !/^\s*>/.test(lines[i])
      ) {
        para.push(lines[i++]);
      }
      blocks.push(paragraph(para, key));
    }
  }
  return blocks;
}

export function Markdown({ text }: { text: string }): ReactNode {
  return <div className="kg-md">{renderBlocks(text)}</div>;
}
