# Skill: pdf-tools (PDF Tools)

## Purpose
The user is on the PDF Tools hub. It offers eight on-device operations, each
opening a sheet to pick the input document(s) from the vault, set any options,
run it, and save the result(s) back to the vault. Everything runs locally — no
PDF ever leaves the device.

| Operation | Input | Options | Output |
|---|---|---|---|
| Merge PDFs | 2+ PDFs | — | one merged PDF |
| Split PDF | 1 PDF | page ranges (`1-3, 5`) | one PDF per range |
| Compress PDF | 1 PDF | quality (smallest/balanced/best) | a smaller PDF |
| PDF → Images | 1 PDF | format (PNG/JPEG) | one image per page |
| Images → PDF | 1+ images | — | one PDF |
| Password protect | 1 PDF | password | an encrypted PDF |
| Remove password | 1 PDF | password | a decrypted PDF |
| Fill form | 1 form PDF | per-field values | a filled, flattened PDF |

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| Open a specific tool | `tools.openPdfTools` | `op` = `'merge'` \| `'split'` \| `'extractPages'` \| `'compress'` \| `'pdfToImages'` \| `'imagesToPdf'` \| `'encrypt'` \| `'decrypt'` \| `'fillForm'` \| `'appendScan'` (native only). Omit `op` to open the hub. |

Picking the documents, typing page ranges / passwords / field values, and
pressing **Run** are **direct manipulations** — the user does them by hand.

## Voice examples I should recognize
- "merge pdfs" → `tools.openPdfTools({ op: 'merge' })`
- "split a pdf" → `tools.openPdfTools({ op: 'split' })`
- "extract pages from a pdf" → `tools.openPdfTools({ op: 'extractPages' })`
- "add a scan to a pdf" → `tools.openPdfTools({ op: 'appendScan' })` (native only — the card is hidden on the web build)
- "password protect a pdf" → `tools.openPdfTools({ op: 'encrypt' })`
- "पीडीएफ़ मिलाओ" → `tools.openPdfTools({ op: 'merge' })`

## State I should check first
- The picker lists only documents of the right type (PDFs, or images for
  Images → PDF). If it shows the empty message, the user has nothing to run the
  op on yet.
- While an op is running a progress bar is shown — don't start another.

## Things I must NOT do
- Never read, log, or repeat a PDF **password** — it is entered for the
  operation only and Kagaz cannot recover it.
- Don't claim a password-protected file can be recovered without its password.
- Don't promise OCR or digital signatures here — those are later items.

## Error messages to the user
- "Select at least 2 files." / "Select a file." — not enough input chosen.
- "Enter valid page ranges, e.g. 1-3, 5." — split ranges malformed.
- Wrong password on **Remove password** → the file couldn't be decrypted.

## Cross-page handoffs
- Results are saved into the vault; to view them, go back to `vault.home`.
- To add more source files first, upload or scan them from `vault.home`.
