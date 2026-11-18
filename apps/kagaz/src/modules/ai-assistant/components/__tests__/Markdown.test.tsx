import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Markdown } from '../Markdown';

const html = (text: string): string => render(<Markdown text={text} />).container.innerHTML;

describe('Markdown', () => {
  it('renders bold, italic, inline code and links', () => {
    const out = html('I found **Rent agreement.pdf** — it is *small*, `id doc-a`, see [docs](https://example.com).');
    expect(out).toContain('<strong>Rent agreement.pdf</strong>');
    expect(out).toContain('<em>small</em>');
    expect(out).toContain('<code>id doc-a</code>');
    expect(out).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer">docs</a>');
  });

  it('renders bullet and numbered lists, headings and quotes', () => {
    const { container } = render(<Markdown text={'## Plan\n- merge them\n- compress\n\n1. open\n2. share\n\n> note this'} />);
    expect(container.querySelector('.kg-md__heading strong')?.textContent).toBe('Plan');
    expect([...container.querySelectorAll('ul li')].map((li) => li.textContent)).toEqual(['merge them', 'compress']);
    expect([...container.querySelectorAll('ol li')].map((li) => li.textContent)).toEqual(['open', 'share']);
    expect(container.querySelector('blockquote')?.textContent).toBe('note this');
  });

  it('renders fenced code verbatim, even unclosed (a reply still streaming)', () => {
    expect(html('```\n**not bold**\nline 2\n```')).toContain('<pre><code>**not bold**\nline 2</code></pre>');
    expect(html('```\nhalf written')).toContain('<pre><code>half written</code></pre>');
  });

  it('keeps single newlines as line breaks and blank lines as paragraphs', () => {
    const { container } = render(<Markdown text={'one\ntwo\n\nthree'} />);
    expect(container.querySelectorAll('p')).toHaveLength(2);
    expect(container.querySelector('p br')).not.toBeNull();
  });

  it('shows unfinished syntax literally while streaming', () => {
    expect(html('so far **bold start')).toContain('so far **bold start');
    expect(html('`open code')).not.toContain('<code>');
  });

  it('leaves snake_case and file names alone', () => {
    const out = html('use my_file_name.pdf and _real italic_');
    expect(out).toContain('my_file_name.pdf');
    expect(out).toContain('<em>real italic</em>');
  });

  it('cannot inject HTML or scripts: tags stay text, unsafe links are not links', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror=alert(1)> <script>alert(2)</script> [click](javascript:alert(3)) [ok](https://a.example)'} />
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).toContain('[click](javascript:alert(3))');
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['https://a.example']);
  });
});
