# Kagaz — V1 UX Polish & Redesign Plan

> **Purpose** · Last Updated: 2026-07-12
>
> Captures the round of real-device testing feedback (2026-07-12) as a single,
> reviewable plan before implementation. Each item has a problem statement, a
> **design decision**, an implementation sketch, and a **target branch** (one
> Conventional-Commit branch per logical unit, per `CONTRIBUTING.md` / `AGENT.md`).
> Rules apply: tokens only (no hardcoded visuals — `design-tokens.md`), one
> primary action per screen (`design-principles.md`), every new page ships its
> `.tsx` + `.agent.ts` + `.skill.md`, 80% test coverage, docs updated in the same
> PR. Items map to checklist rows **UX-1 … UX-12** in `DEVELOPMENT-CHECKLIST.md`.

## Table of Contents
- [Priorities & sequencing](#priorities--sequencing)
- [A. Bugs / broken UI](#a-bugs--broken-ui)
- [B. Missing features / gaps](#b-missing-features--gaps)
- [C. Performance](#c-performance)
- [D. Design-system pass](#d-design-system-pass)

## Priorities & sequencing

| # | Item | Type | Size | Branch |
|---|---|---|---|---|
| UX-1 | Individual **Delete** in the ⋮ menu | bug | S | `feature/ux1-item-delete` |
| UX-2 | **Tag chips** blow up row height | bug (CSS) | S | `bugfix/ux2-tag-chip-height` |
| UX-3 | **Mic inline** in the search bar | bug (layout) | S | `bugfix/ux3-mic-inline` |
| UX-4 | **Upload sheet** clips "Browse files" | bug (layout) | S | `bugfix/ux4-upload-sheet` |
| UX-5 | **List row** decluttered + redesigned | design | M | `feature/ux5-list-row-redesign` |
| UX-6 | **Document viewer** (image + PDF) — the missing preview; also **shows OCR text** | feature | L | `feature/ux6-document-viewer` |
| UX-7 | **View modes** (list / grid / compact), persisted | feature | M | `feature/ux7-view-modes` |
| UX-8 | **Rename prompt** after add, + Settings toggle | feature | M | `feature/ux8-rename-on-add` |
| UX-9 | **OCR result visibility** (folded into UX-6 viewer) + image-only clarity | fix | S | with UX-6 |
| UX-10 | **PDF merge** slow after 100% | perf | M | `bugfix/ux10-merge-perf` |
| UX-11 | **PDF compress** slow (1-page) | perf | M | `bugfix/ux11-compress-perf` |
| UX-12 | **Design-system pass** (density, hierarchy, tokens) | design | L | `feature/ux12-design-pass` |
| UX-13 | **Text extraction for all docs** (PDF text-layer + OCR) → search/AI | feature | M | `feature/ux13-doc-text-extraction` |

Suggested order: quick bugs first (UX-1→UX-4) to make the app feel right, then
UX-5 + UX-6 (the big visible wins: clean rows + a real viewer that also answers
"where's my OCR text"), then UX-7/UX-8, then the perf items (UX-10/UX-11), with
UX-12 threading through as the shared design language.

---

## A. Bugs / broken UI

### UX-1 · Individual Delete in the ⋮ menu
**Problem:** a single document can only be deleted via multi-select; the ⋮ item
menu (add-tag / move / select / lock / extract-text) has **no Delete**.
**Decision:** add a **destructive** "Delete" action to the ⋮ sheet (Ionic
`role: 'destructive'`), routing through the existing soft-delete → **Trash**
(F-57), not a hard delete — so it's recoverable and consistent. Show the
"moved to Trash" toast with **Undo**. No confirmation dialog (Trash is the
safety net); confirmation stays only for permanent deletion in Trash.
**Impl:** reuse `useVaultMutations`/DAO `softDelete` (or the bulk-delete path for
one id); add `actions.delete` string; `data-agent-action="vault.deleteDocument"`.

### UX-2 · Tag chips blow up the row height
**Problem:** assigning a tag makes the list row very tall — the tag chip row
isn't constrained.
**Decision:** cap the tag area: single line, `overflow: hidden`, chips at a
fixed small height (`--text-xs`, `--space-1` padding), show at most **2 chips +
"+N"**; never wrap to multiple lines in the compact row.
**Impl:** CSS on `.kg-doc-item__tags` / `Tag` size; truncate in `DocumentListItem`.

### UX-3 · Mic inline in the search bar
**Problem:** the voice mic (F-15) sits as a **sibling** beside the search bar
(`kg-vault__search-row` flex), not inside it.
**Decision:** move `MicButton` **into** the searchbar as a trailing (end-slot)
control, so search + mic read as one field. `IonSearchbar` doesn't expose an
end slot, so wrap: a relative container with the searchbar filling it and the
mic absolutely positioned at the inline-end (RTL-safe via `inset-inline-end`).
Keep it hidden when STT is unsupported (`isScanningSupported`-style gate).
**Impl:** refactor `SearchBar` to host the mic; drop `kg-vault__search-row`.

### UX-4 · Upload sheet clips "Browse files"
**Problem:** since **Scan** was added (4 options), the bottom option is cut off
on shorter screens — `UploadOptionsSheet` uses a fixed `initialBreakpoint={0.35}`.
**Decision:** make the sheet **fit its content** — `initialBreakpoint` computed
from option count (or `auto`), `breakpoints={[0, 0.5, 0.75]}`, and a scrollable
content area with safe-area bottom padding so no option is ever clipped.
**Impl:** `UploadOptionsSheet` breakpoint + `padding-bottom: env(safe-area-inset-bottom)`.

### UX-5 · List row redesigned (decluttered)
**Problem:** rows cram thumbnail + name + type badge + size + date + tags →
cluttered.
**Decision (design):** two-line row —
- **Line 1:** thumbnail/icon · **name** (truncate) · trailing ⋮.
- **Line 2 (muted, small):** `TYPE · size · relative date` as one subtle
  metadata string (no badge chrome); tags on a capped single line (UX-2) only
  when present.
- Star + ⋮ collapse into the ⋮ menu on compact density; star stays inline on
  comfortable. One visual weight for the name, everything else secondary
  (`design-principles.md` hierarchy). Aligns with `component-library.md` list item.
**Impl:** rework `DocumentListItem` markup + `vault.css`; keep `data-agent-id`s.

---

## B. Missing features / gaps

### UX-6 · Document viewer (the missing preview) + OCR text
**Problem:** tapping a document shows a **"preview coming soon" toast** — there
is no viewer (the F-24 note flagged this as a follow-up). And OCR'd text has
**nowhere to be seen** (it only feeds search + a toast), so OCR "looks broken."
**Decision:** ship a real **Document Viewer** route `/doc/:id`:
- **Images** → rendered full-screen (pinch-zoom via Ionic/`img`), from the
  stored file via `convertFileSrc`.
- **PDFs** → render pages with the existing lazy **pdfjs** (already used for
  thumbnails) — page canvas(es), swipe/scroll.
- **Header actions:** the same ops (share, delete→Trash, rename, extract-text).
- **OCR panel (answers "where to see OCR"):** if `ocr_text` exists, a
  collapsible "Extracted text" section with the text + **Copy**; if empty and
  the doc is an image, an **"Extract text"** button that runs OCR inline and
  fills the panel. Make it obvious OCR is **image-only** (button hidden/disabled
  with a hint on PDFs — PDF OCR = rasterize-then-OCR, a later item).
- Replaces the stopgap toast in `VaultHomePage.handleOpen`.
**Impl:** new page trio `DocumentViewerPage.{tsx,agent.ts,skill.md}` + route;
`useDocument(id)`; reuse `useDocumentOcr`; `[SEC]` respects per-doc lock
(authorize before viewing, like `authorizeView`).

### UX-7 · View modes (list / grid / compact)
**Problem:** only a single list view.
**Decision:** a **view-mode toggle** in the vault controls bar cycling **List ·
Grid · Compact**, persisted (`kagaz:view-mode`, like theme). Grid = thumbnail
cards (2–3 cols responsive); Compact = dense single-line rows. Maps to the three
density modes in `design-principles.md`. Folders already render as a grid;
documents adopt the chosen mode.
**Impl:** `useViewMode` (localStorage) + a `ViewModeControl`; `DocumentGrid` +
`DocumentListItem` density variants; wire in `VaultHomePage`.

### UX-8 · Rename prompt after add + Settings toggle
**Problem:** scanned/selected docs are saved with an auto default name; no chance
to rename at capture.
**Decision:** after a successful add (scan / camera / gallery / files), show a
**rename prompt pre-filled with the default name**; **Save** stores the (edited
or unchanged) name, **Skip/Cancel** keeps the default. A **Settings → General →
"Ask to rename new documents"** toggle (default **on**) disables it — when off,
the default name is stored silently. Multi-file adds: prompt once per file, or a
single "keep defaults" — decide simplest: prompt sequentially, "Skip all"
option.
**Impl:** `useRenamePrompt` + an IonAlert (reuse the new-folder alert pattern);
`kagaz:rename-on-add` pref + Settings toggle; hook into `useUpload.ingestFiles`
post-insert (rename via DAO `update({name})`).

### UX-9 · OCR result visibility + image-only clarity
Folded into **UX-6** (the viewer's Extracted-text panel). Standalone tweaks:
the ⋮ "Extract text" stays but its toast now says *"Text saved — open the
document to read it"*; the action is **hidden on non-image** docs (already gated
by `canOcr`) — add a one-time hint so users know OCR is for images/scans.

---

### UX-13 · Text extraction for all documents (PDF text-layer + OCR)
**Problem:** OCR (UX-9) only covers **images**. **PDFs** — the common case —
aren't searchable by content, and there's no text to feed future AI (WebLLM).
**Decision:** one **"extract text"** capability that picks the right method per
document:
- **PDF with a text layer** (born-digital) → **pdfjs `getTextContent()`** per
  page — fast, exact, no OCR, no ML Kit.
- **Image, or image-only/scanned PDF** (no/short text layer) → **ML Kit OCR**
  (UX-9): rasterize PDF pages via pdfjs → OCR each. Heuristic: if the text layer
  yields < N chars, fall back to OCR.
- Store the result in `documents.ocr_text` (rename the *concept* to "extracted
  text"; the column already feeds **FTS**) → searchable immediately, and the
  same field is what WebLLM/AI will read later (metadata-only boundary, §5).
- Surfaced in the UX-6 viewer's "Extracted text" panel + the ⋮ action; runs in
  the existing worker where possible; `[SEC]` text stays in the encrypted DB,
  never logged.
**Impl:** extend `image-engine/ocr.service` + a `pdf-engine` text-extract helper
(`extractPdfText` via pdfjs); a unified `extractDocumentText(doc)` that routes by
type; `useDocumentOcr` → `useDocumentText`. Feeds UX-6 + search.

## C. Performance

### UX-10 · PDF merge slow even after 100%
**Problem:** merge shows 100% then hangs for seconds, even for a 2-page merge.
**Suspects to profile:** (a) the post-op **thumbnail regeneration** (pdfjs first
-page render) running on the main thread after the worker returns; (b) writing
the merged blob to the encrypted DB/filesystem (base64 round-trip in
`base64.ts`); (c) the worker→UI transfer copying a large `Uint8Array` instead of
transferring it; (d) an artificial/finished progress bar that completes before
the real save. **Decision:** instrument the merge op end-to-end (logcat timings
around worker return → file write → thumbnail → store), then fix the dominant
cost — likely move thumbnail gen off the critical path (defer/async) and
**transfer** the result buffer. Keep the progress bar tied to the *actual* last
step so 100% means done.

### UX-11 · PDF compress slow even for 1-page PDF
**Problem:** compress is slow even for a 1-page PDF.
**Suspects:** the compress path rasterizes pages via pdfjs → re-encodes → rebuilds
the PDF (ADR-004/03); for one page that shouldn't be slow — profile whether
pdfjs **worker/init** is being paid per-op (cold-start the WASM/worker each time)
vs. reused, and whether the render scale is too high. **Decision:** reuse a
warm pdfjs worker across ops; cap render scale to a sane DPI; profile + fix the
dominant cost. Same instrumentation harness as UX-10.

---

## D. Design-system pass

### UX-12 · Coherent design pass
The above are point fixes; UX-12 is the connective tissue: audit spacing/density,
type scale, the metadata hierarchy, empty states, and touch targets against
`design-principles.md`, and fold the decisions back into `component-library.md`
+ `interaction-patterns.md` so list/grid/viewer/sheets share one language.
Runs alongside UX-5/6/7 rather than as a separate big-bang.
