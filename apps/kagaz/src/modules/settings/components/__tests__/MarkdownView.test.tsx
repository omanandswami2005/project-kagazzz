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
});
