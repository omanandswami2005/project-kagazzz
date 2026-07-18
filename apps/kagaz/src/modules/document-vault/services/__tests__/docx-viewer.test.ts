import { describe, expect, it } from 'vitest';
import { buildWordFromText } from '@/modules/pdf-engine/services/pdf-to-word-ops';
import { convertDocxToHtml, sanitizeDocxHtml } from '../docx-viewer';

describe('sanitizeDocxHtml (F-43)', () => {
  it('keeps allow-listed formatting tags', () => {
    const out = sanitizeDocxHtml('<p>Hello <strong>world</strong></p>');
    expect(out).toContain('<p>');
    expect(out).toContain('<strong>world</strong>');
  });

  it('removes <script> tags entirely', () => {
    const out = sanitizeDocxHtml('<p>ok</p><script>alert(1)</script>');
    expect(out).not.toContain('script');
    expect(out).toContain('ok');
  });

  it('strips event-handler attributes', () => {
    const out = sanitizeDocxHtml('<p onclick="steal()">hi</p>');
    expect(out).not.toContain('onclick');
    expect(out).toContain('hi');
  });

  it('drops javascript: links but keeps the text', () => {
    const out = sanitizeDocxHtml('<a href="javascript:evil()">click</a>');
    expect(out).not.toContain('javascript:');
    expect(out).toContain('click');
  });

  it('keeps safe https links', () => {
    const out = sanitizeDocxHtml('<a href="https://example.com">site</a>');
    expect(out).toContain('href="https://example.com"');
  });

  it('unwraps unknown tags but keeps their text', () => {
    const out = sanitizeDocxHtml('<marquee>scrolling</marquee>');
    expect(out).not.toContain('marquee');
    expect(out).toContain('scrolling');
  });
});

describe('convertDocxToHtml (F-43)', () => {
  it('renders a .docx back to HTML carrying its text', async () => {
    // Round-trip: F-41 builds the .docx, F-43 reads it back.
    const blob = await buildWordFromText('Report', 'Hello from Kagaz');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const html = await convertDocxToHtml(bytes);
    expect(html).toContain('Hello from Kagaz');
    expect(html).not.toContain('<script');
  });
});
