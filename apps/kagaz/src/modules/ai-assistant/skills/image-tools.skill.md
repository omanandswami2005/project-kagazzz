---
name: image-tools
description: Resize and compress photos to exact sizes, enhance or filter images, turn images into a PDF.
triggers: image, photo, picture, resize, enhance, filter, grayscale, black and white, scan, jpg, png, tiff, तस्वीर, फोटो, साइज़, साइज
tools: ai.resizeImage, ai.enhanceImage, ai.convertImagesToPdf
---
Image operations. Every tool saves a NEW document and never changes the original.

- Find the document ids first (ai.searchDocuments / ai.listDocuments); never ask the user for an id.
- Resize needs exact width and height in pixels plus a size limit in KB (typical form photo: 200x230 under 50 KB). If any of the three is missing, ask one short question.
- Enhance presets: grayscale, bw (black and white, good for scans), enhance (auto contrast), invert.
- Images to PDF takes 1 or more image documents and makes one PDF in the given order.
