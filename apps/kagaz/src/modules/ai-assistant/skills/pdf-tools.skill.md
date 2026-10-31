---
name: pdf-tools
description: Merge, split, compress and watermark PDFs; turn a PDF into images or text.
triggers: pdf, merge, combine, split, compress, shrink, watermark, page, pages, पीडीएफ, मर्ज, मिला, बांट, छोटा
tools: ai.mergeDocuments, ai.splitDocument, ai.compressDocument, ai.watermarkDocument, ai.convertPdfToImages, ai.exportPdfText
---
PDF operations. Every tool saves a NEW document and never changes the original.

- Find the document ids first (ai.searchDocuments / ai.listDocuments); never ask the user for an id.
- Merge needs 2 or more PDFs, in the order the user wants. Split takes 1-indexed inclusive page ranges ("pages 1 to 3" = start 1, end 3).
- Compress quality is low, medium or high; default to medium unless the user says otherwise.
- Watermark needs the text to stamp. If the user did not say what text, ask one short question.
- PDF to images: format is jpeg or png. PDF to text: format is txt or md.
- After the tool succeeds, say what was created in one sentence.
