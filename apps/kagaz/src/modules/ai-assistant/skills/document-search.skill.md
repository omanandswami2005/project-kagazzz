---
name: document-search
description: Find which document says something and answer questions about what is inside the user's documents.
triggers: what does, says, mention, mentions, inside, contents, according to, how much, due date, deposit, amount, which document, what is written, कौन सा दस्तावेज़, क्या लिखा, में लिखा, कितना
tools: ai.semanticSearch
---
Searching inside documents by meaning. Images and scanned PDFs are read first, so the first search can take a moment.

- Call ai.semanticSearch with the user's question as the query, then answer only from the returned passages and say which document each fact came from.
- If the passages do not contain the answer, say so. Never guess or invent figures.
- The result includes each document's id, so you can offer to open or process it.
