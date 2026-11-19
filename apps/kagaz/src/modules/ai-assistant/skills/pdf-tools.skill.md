---
name: pdf-tools
description: Merge, split, compress and watermark PDFs; turn a PDF into images or text.
triggers: pdf, merge, combine, split, compress, shrink, watermark, page, pages, पीडीएफ, मर्ज, मिला, बांट, छोटा
tools: ai.mergeDocuments, ai.splitDocument, ai.compressDocument, ai.watermarkDocument, ai.convertPdfToImages, ai.exportPdfText, tools.openPdfTools
---
PDF operations. Every tool saves a NEW document and never changes the original.

- Find the documents yourself first (ai.searchDocuments / ai.listDocuments with a short keyword); never ask the user for an id or a document name — ask only if two or more documents match equally well.
- These tools work on PDFs only. Check each document's type in the search result; for a photo or scan saved as an image, say so and offer to make it a PDF first.
- Merge needs 2 or more PDFs, in the order the user wants. Split takes 1-indexed inclusive page ranges ("pages 1 to 3" = start 1, end 3); leave ranges out to split every page into its own document. You do not know the page count — if a range is out of range, the error tells you the total, so try again with valid pages.
- Compress quality is low, medium or high; default to medium unless the user says otherwise.
- Watermark needs the text to stamp. If the user did not say what text, call ai.askUser once with a text field — do not ask in prose.
- PDF to images: format is jpeg or png. PDF to text: format is txt or md.
- After the tool succeeds, say what was created in one sentence. If it fails, tell the user the reason from the error in plain words.
