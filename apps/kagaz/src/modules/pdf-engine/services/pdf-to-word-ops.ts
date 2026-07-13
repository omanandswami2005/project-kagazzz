/**
 * PDF → Word (.docx) generation (F-41). Lazy-loads `docx` (ADR-020: MIT,
 * pure-JS, no network/WASM — audited) so it never weighs on the main chunk,
 * and builds a text-first document from a PDF's extracted text. Layout is not
 * preserved — the conversion carries the text, with each source line a
 * paragraph, under a bold title. Runs on the main thread (like text extraction).
 *
 * [SEC] the text passed in is document content; this module never logs it.
 */

/**
 * Builds a `.docx` Blob from a title and extracted text (F-41). Blank lines in
 * the source become empty paragraphs so paragraph breaks survive.
 */
export async function buildWordFromText(title: string, text: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');

  const bodyParagraphs = text
    .split('\n')
    .map((line) => new Paragraph({ children: [new TextRun(line)] }));

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [new TextRun({ text: title, bold: true, size: 32 })],
          }),
          ...bodyParagraphs,
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}
