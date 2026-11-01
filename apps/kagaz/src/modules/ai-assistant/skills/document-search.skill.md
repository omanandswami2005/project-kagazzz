---
name: document-search
description: Find which document says something and answer questions about what is inside the user's documents.
triggers: number, phone, mobile, contact, address, name on, date of birth, dob, contains, written, text, find the card, मोबाइल, नंबर, फोन, पता, what does, says, mention, mentions, inside, contents, according to, how much, due date, deposit, amount, which document, what is written, कौन सा दस्तावेज़, क्या लिखा, में लिखा, कितना
tools: ai.findInDocuments, ai.readDocumentText, ai.semanticSearch
---
Looking inside documents. Text is extracted automatically when a document is uploaded.

- To answer "what is the <thing> on/in <document>" (a mobile number, date, amount, name): call ai.findInDocuments with ONE short distinctive keyword (e.g. "rover"), then ai.readDocumentText on the best match and answer from its text. Name the document you used.
- If findInDocuments finds nothing, try ai.semanticSearch (needs the optional search model) or a different keyword.
- If the text does not contain the answer, say so. Never guess or invent numbers, dates or amounts.
- Results include each document's id, so you can offer to open or process it.
