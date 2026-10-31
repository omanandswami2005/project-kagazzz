---
name: text-extraction
description: Read the text inside an image or scanned document so it becomes searchable.
triggers: ocr, read the text, extract text, searchable, scanned, text in, पाठ, टेक्स्ट पढ़
tools: ai.runOcr
---
Text extraction. ai.runOcr reads a document's text and stores it so search can find it.

- You never see the text itself, only how many characters were found. If the user asks what the text says, explain you cannot read document contents for privacy and that they can open the document to see it.
- Find the document yourself first (ai.searchDocuments / ai.listDocuments with a short keyword); never ask the user for an id or a document name — ask only if two or more documents match equally well.
