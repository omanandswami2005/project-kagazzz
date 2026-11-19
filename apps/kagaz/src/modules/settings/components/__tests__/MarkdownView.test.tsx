import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from '../MarkdownView';

describe('MarkdownView (G1-5)', () => {
  it('renders headings, paragraphs, and bullet lists', () => {
    const { container } = render(
      <MarkdownView source={'# Title\n\nHello world\n\n- one\n- two'} />
    );
    expect(container.querySelector('h2')?.textContent).toBe('Title');
    expect(container.querySelector('p')?.textContent).toBe('Hello world');
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('renders inline bold', () => {
    const { container } = render(<MarkdownView source={'a **bold** word'} />);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
  });

  it('renders safe https links as anchors', () => {
    const { container } = render(
      <MarkdownView source={'[site](https://example.com)'} />
    );
    const a = container.querySelector('a');
    expect(a?.getAttribute('href')).toBe('https://example.com');
  });

  it('does NOT render a javascript: link as an anchor (XSS)', () => {
    const { container } = render(
      <MarkdownView source={'[click](javascript:alert(1))'} />
    );
    expect(container.querySelector('a')).toBeNull();
    // The text still shows, just not as a link.
    expect(container.textContent).toContain('click');
    expect(container.innerHTML).not.toContain('javascript:');
  });

  it('renders a horizontal rule for ---', () => {
    const { container } = render(<MarkdownView source={'above\n\n---\n\nbelow'} />);
    expect(container.querySelector('hr')).not.toBeNull();
  });

  it('adds a contents list after the title when there are 4+ sections (LG-2)', () => {
    const source = '# Title\n\n## One\n\na\n\n## Two\n\nb\n\n## Three\n\nc\n\n## Four\n\nd';
    const { container } = render(<MarkdownView source={source} tocLabel="Contents" />);
    const nav = container.querySelector('nav[aria-label="Contents"]');
    expect(nav?.querySelectorAll('button')).toHaveLength(4);
    expect(container.firstElementChild?.firstElementChild?.tagName).toBe('H2'); // title first
    expect(container.querySelector('#md-section-3')?.textContent).toBe('Four');
  });

  it('skips the contents list for short texts', () => {
    const { container } = render(<MarkdownView source={'## One\n\n## Two'} tocLabel="Contents" />);
    expect(container.querySelector('nav')).toBeNull();
  });
});
