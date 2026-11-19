# Screen Audit — every page, one by one

> **UX screen audit** · Last Updated: 2026-11-19 · Source: 116 screenshots (60 light + 56 dark) at a 412 × 915 phone viewport, captured by [`scripts/ux/capture-screens.mjs`](../../scripts/ux/capture-screens.mjs) from the browser web demo with fake documents · Companion to the [smart UI plan](smart-ui-next-best-action.md)

For each page: **bugs** (functional), **visual bugs**, **borders · sizing ·
spacing**, **next-best actions**, **improvements**, **animations**, **icons**.
Every finding is tagged with the framework it comes from:

| Tag | Framework | Question it asks |
|---|---|---|
| **NBA** | Next-best action / contextual affordance | What will the user do right after this? Is it in their path? |
| **PD** | Progressive disclosure | Is the common thing visible and the rare thing one step away? |
| **DM** | Direct manipulation | Can they act on the object itself (tap, drag, swipe)? |
| **GoE** | Gulf of execution (Norman) | How many steps between intent and result? |
| **Hook** | Trigger → action → reward → investment | Is the result rewarding and does it set up the next visit? |
| **AD** | Anticipatory design (on-device signals only) | Can we pre-surface what they'll want? |
| **A11y** | WCAG 2.1 AA | Contrast, touch targets, focus |

IDs (`G-3`, `VH-7`, …) are stable so commits can reference them. Priority:
**P0** broken or misleading · **P1** clear friction · **P2** polish.

Regenerate the screenshots (they are gitignored, `docs/ux/screens/`):

```bash
pnpm --filter kagaz dev:web-demo -- --port 5199        # terminal 1
node scripts/ux/capture-screens.mjs --theme both       # terminal 2 → docs/ux/screens/{light,dark}
```

Native-only flows (scanner, camera, biometric, on-device AI, share sheet) can't
run in the browser; their states here are the web fallbacks and need a device
pass.

---

## Table of Contents

- [Status after the fixes](#status-after-the-fixes)
- [M. Measured — colours, sizes, WCAG AA](#m-measured--colours-sizes-wcag-aa)
- [G. Global — affects every page](#g-global--affects-every-page)
- [OB. Onboarding](#ob-onboarding)
- [VH. Documents (vault home)](#vh-documents-vault-home)
- [UP. Add a document (FAB, upload sheet, rename prompt)](#up-add-a-document-fab-upload-sheet-rename-prompt)
- [IM. Document menu (⋮ sheet)](#im-document-menu--sheet)
- [FP. Filter panel](#fp-filter-panel)
- [DR. Side drawer](#dr-side-drawer)
- [VW. Document viewer](#vw-document-viewer)
- [FV. Favorites](#fv-favorites)
- [ST. Storage](#st-storage)
- [PT. PDF Tools hub](#pt-pdf-tools-hub)
- [TS. Tool sheets (all 18 tools)](#ts-tool-sheets-all-18-tools)
- [QR. Quick Reference](#qr-quick-reference)
- [QN. Quick Notes](#qn-quick-notes)
- [AR. Archived · TR. Trash](#ar-archived--tr-trash)
- [AI. AI model page · AI chat](#ai-ai-model-page--ai-chat)
- [LG. Legal pages (privacy, terms, licenses)](#lg-legal-pages-privacy-terms-licenses)
- [SE. Settings](#se-settings)
- [Fix order](#fix-order)

---

## Status after the fixes

Fixed on `feature/ux-audit-fixes` (2026-11-19), in the batches of the [Fix order](#fix-order). Device pass on the `Pixel6_API34` emulator (debug APK): cold start, onboarding → "Add your first document" opens the upload sheet, hardware back closes the sheet, the tab bar hides on Settings and returns after back, the exit toast sits above the tab bar (G-5), dark mode is navy (G-1), Hindi is readable. Scanner, camera and AI flows still need real hardware. Re-measured by re-running the capture script on every screen (59 per theme):

| Measure | Before | After |
|---|---|---|
| Text below WCAG AA (light / dark) | 100 / 125 | **0 / 0** |
| Tap targets under 44 px (light / dark) | 233 / 248 | **8 / 8**: only the toggle switch graphic; the whole 48 px label row is the tap target (M-8) |

**Fixed:** all P0 (G-1, M-1/2/3, M-10, TS-1, LG-1 as a draft for counsel) · every P1 except QR-2, AI-2 and part of ST-5 · and these P2s: G-7, G-8, G-9, G-10, M-4…M-9, M-12, M-13, M-15, OB-1…OB-7, OB-9, OB-10, VH-3, VH-7, VH-11 (Material header), VH-18, VH-19, UP-3, UP-4, UP-9, IM-2, IM-4…IM-7, FP-3, FP-4, FP-5, DR-1…DR-6, VW-6, VW-11 (page fade), VW-12, FV-2, FV-3, ST-3, ST-4, ST-6, PT-1…PT-4, PT-7, PT-8, TS-3, TS-4, TS-5, TS-10, TS-12, TS-13, QR-1, QR-4, QN-1, QN-3, TR-1, TR-2, AR-1, AI-1, AI-3, LG-2, LG-3, SE-1…SE-9.

**Not done, and why:**

| ID | Why it is still open |
|---|---|
| QR-2, QN-2 | Moving ID numbers between stores needs a compliance decision first: Aadhaar numbers must never be stored raw (UIDAI rules), so "Move to Quick Reference" can't simply copy what's detected. |
| ST-5 (part) | Each large PDF has an inline **Compress**, but the "Free up space" header action and "save ~X KB" estimates aren't built: an honest estimate needs a dry-run compress per file. |
| AI-2, OB-8 | Need a phone: the real AI states (download, load, chat) and the Hindi layout can't run in the browser demo. |
| VW-5 | The line breaks are lost in the OCR output itself, not in the viewer, so it can't be fixed in the UI. |
| VH-9, VH-10, VH-14, VH-16, VH-17, VW-9, VW-10, UP-6, FV-4, FV-5, ST-2, ST-7, ST-8, PT-6, FP-6, UP-8 | P2 refinements (per-density row heights, suggestion chips, swipe peek, pull-to-search, pinch zoom, reorder favourites, bar chart instead of donut, grouped tool headings). Each is a feature in its own right; left for a follow-up. |

---

## M. Measured — colours, sizes, WCAG AA

The capture script measures every screen in the browser (computed styles, not
eyeballing) and writes `<screen>.audit.md` beside each screenshot: text below
AA, tap targets under 44 px, and every distinct text colour, font size,
radius and border actually rendered. Totals across all 116 screens:

### M.1 Text below WCAG AA (4.5:1 normal, 3:1 large)

| ID | P | Element(s) | Measured | Root cause | Fix (verified ratio) |
|---|---|---|---|---|---|
| M-1 | **P0** | Document meta line ("PDF · 715 B · 19 November 2026") on every list/grid/compact row; Trash & Archived hints and empty titles; Storage percentages; viewer "No text extracted" | light **2.45:1** (`#94A3B8` on `#F8FAFC`) · dark **3.75:1** (`#64748B` on `#0F172A`), **4.41:1** on the black background (G-1) | **`--text-muted` is inverted between themes** — the light theme got the dark value and vice versa | Swap: light `--text-muted: #64748B` (**4.55:1**), dark `--text-muted: #94A3B8` (**6.96:1** on surface-1, 5.71:1 on surface-2). Fixes all 13 findings in one token change. |
| M-2 | **P0** | "Delete" in the document menu and viewer menu (red text) | **3.51:1** (`#F43F5E` on `#F8FAFC`) | `--color-danger` rose-500 is too light for text | Light `--color-danger: #BE123C` (**6.01:1** as text, **6.29:1** under white); dark keeps `#F43F5E` (4.86:1 on navy) or `#FB7185` (6.63:1). |
| M-3 | **P0** | "Delete all data" button (white on red) | **3.67:1** | same as M-2 | same token fix → 6.29:1 |
| — | — | Gradient buttons (Run, Next, Apply, Add, selected pills) | not measurable in-page | gradient background | Checked by hand in design-tokens.md §Brand Gradient (≥ 5.02:1 every stop, both themes) ✅ |

### M.2 Tap targets under 44 × 44 px

| ID | P | Element | Measured | Fix |
|---|---|---|---|---|
| M-4 | **P1** | Filter chips (PDF, Images, Other, size ranges) | **22 px** tall | 40 px chips inside a 48 px row (Material filter chip) — FP-1 |
| M-5 | **P1** | Detected-number chips in the viewer | **26 px** | 36 px chip + 4 px padding = 44 px hit area |
| M-6 | **P1** | View-mode buttons (list / grid / compact) | **48 × 32** | 40 px tall segment (shared SegmentedControl, G-6) |
| M-7 | P1 | `Button size="sm"` everywhere (category chips, Filter, sort direction, sheet close ✕, Skip, quality options, swipe-action pills, Settings rows) | **41 px** tall | `sm` = 44 px min-height (`--touch-target`); it is the size most screens use |
| M-8 | P2 | Toggles (Settings, filter "Favorites only") | control 43 × 24 | the whole row should be the hit area (label + toggle), 48 px |
| M-9 | P2 | Viewer ⋮ in the header | 40 × 42 | 48 × 48 like the ☰ button |

### M.3 Consistency — distinct values actually rendered

| ID | P | Property | Rendered | Off-system values | Fix |
|---|---|---|---|---|---|
| M-10 | **P1** | Font size | 12, **13.33**, 14, 16, **17**, 18, 24, **26** px | **13.33 px** = the browser default for `<button>`: the document row is a `<button>` that doesn't inherit `font`, so **every document name renders at 13.33 px instead of 16 px** (looks small and differs from other rows). **17 px** = Ionic's toolbar title default. **26 px** = Storage donut total. | `button { font: inherit }` in the base styles; toolbar title `--text-lg`; donut total `--text-2xl`. |
| M-11 | P1 | Border colour | `--border-default` plus Ionic's `rgba(0,0,0,.2)` (light) / `#262626` (dark) on the tab bar and toolbars | Ionic defaults, not tokens | Bridge `--ion-tab-bar-border-color`, `--ion-toolbar-border-color` → `--border-default` (with G-1). |
| M-12 | P2 | Border colour | Quick-notes banner `color-mix(warning 35%)` | one-off mix | `--color-warning-border` token (or `--border-strong`). |
| M-13 | P2 | Radius | 4, 8, 12, 16, full | all on the scale ✅ — but cards use 8 (doc rows) **and** 12 (recent, tool cards) **and** 16 (sheets) | Cards 12 (`--radius-lg`), sheets 16, chips full, inputs 8 — document the mapping in design-tokens.md. |
| M-14 | P2 | Text colour | light 6 / dark 7 distinct | none off-token ✅ | — |
| M-15 | P2 | Picker tile border | 2 px transparent + 2 px `--surface-1` badge ring + 2 px saffron when selected | three 2 px borders on one tile | Keep the selected ring; drop the transparent placeholder border (use `outline` for the selected state so layout doesn't need a reserved border). |

---

## G. Global — affects every page

| ID | P | Finding | Tag | Fix |
|---|---|---|---|---|
| G-1 | **P0** | **Dark mode pages and sheets are black / grey, not navy.** Ionic's `palettes/dark.class.css` sets `--ion-background-color` with `.ion-palette-dark.ios` (`#000`) / `.md` (`#121212`) — higher specificity than our `:root` bridge in `app.css`, so every `IonContent`, modal and alert ignores `--surface-1`. Visible on Documents, Viewer, Favorites, Storage, Settings, every tool sheet (`#1e1e1e`). Onboarding (not an IonContent) is correctly navy — the contrast proves it. | Visual | Bridge the Ionic variables under `:root, .ion-palette-dark.ios, .ion-palette-dark.md` (or drop the Ionic dark palette import — we bridge everything ourselves). Add `--ion-background-color-rgb`, `--ion-item-background`, `--ion-toolbar-background`, `--ion-card-background`, modal `--background`. |
| G-2 | **P1** | **Tab bar shows on detail pages** (viewer, settings, trash, quick reference, legal, AI…). The viewer stacks two bottom bars (next actions + tabs = 150 px of chrome). | PD | Hide the tab bar on non-root routes (`IonTabBar` hidden when the route isn't a tab root; Ionic pattern: tabs only on the four roots). |
| G-3 | P1 | **Muted text fails contrast** — measured, root cause and fix in **M-1** (the token is inverted between themes). | A11y | M-1 |
| G-4 | P1 | **Dates are long and truncate**: "19 November 2026" cut to "19 November 20" in grid cards. | GoE | Relative for recent ("Today", "Yesterday"), short otherwise ("19 Nov"); full date in Details. One `formatShortDate` in `core/i18n/utils`. |
| G-5 | P1 | **Toasts cover the tab bar** ("5 documents added" sits on the tabs). | Visual | Position toasts above the tab bar (`position-anchor` = tab bar, or bottom offset = tab-bar height). |
| G-6 | P1 | **Two segmented-control styles**: view-mode uses a track with a white selected pill; Compress quality / theme / language / swipe actions use separate outline buttons with a filled gradient one. | Visual | One `SegmentedControl` in `@kagaz/ui` (track + raised selected), used everywhere a single choice is made. |
| G-7 | P2 | **Primary buttons glow** (`--shadow-glow-brand`) on every small "Add"/"Apply" — glow is meant for the one primary CTA per screen. | Visual | Glow only on the screen's main CTA and the FAB; plain primary elsewhere. |
| G-8 | P2 | **Empty states are inconsistent**: icon colour (grey vs saffron), CTA (some have Add, Favorites/Trash have none), vertical position (top vs centre). | Visual · NBA | One `EmptyState` molecule: icon (object role), title, hint (`--text-secondary`), optional primary action; top-third aligned. |
| G-9 | P2 | **Page titles are centred everywhere** (iOS style) while the app is Android-first; long titles ("Open-source licenses") crowd the Back label. | Visual | Material: left-aligned title after ☰/back; drop the "Back" text label (arrow only, 48 px target). |
| G-10 | P2 | **No motion language.** Pages, sheets, list changes and state changes all cut instantly except Ionic's defaults. | Hook | See each page's *Animations*; respect `prefers-reduced-motion` and Simple mode (`--duration-default: 0ms`). |

---

## OB. Onboarding

Screens: `01`–`04` (4 slides).

- **Bugs**
  - OB-1 (P2) On slide 1 "Back" is shown greyed — it does nothing there. Hide it on the first slide.
- **Visual bugs**
  - OB-2 (P1, A11y) Inactive progress dots are almost invisible (≈1.2:1 light, ≈1.4:1 dark). Use `--border-strong`.
  - OB-3 (P2) Generic line icons (file, lock, scan corners, download) — nothing says *Kagazzz*. Slide 1 should show the app mark.
- **Borders · sizing · spacing**
  - OB-4 (P2) Content is centred in a 915 px screen with ~300 px empty above and below; the 96 px icon circle is small for a hero. Hero 160 px, block at upper third, 24 px between icon → title → body.
  - OB-5 (P2) "Next" is a small right-aligned button; on phones the primary should be full-width at the bottom (thumb zone), Back as a text link on the left of the dots.
- **Next-best actions**
  - OB-6 (P1, NBA·GoE) "Get started" drops the user on an empty vault. Last slide should offer the first action directly: **Scan a document** · **Add from files** · **Set up starter folders**.
  - OB-7 (P2, NBA) Slide 4 talks about the fingerprint lock — offer **Turn on app lock** right there (one tap) instead of sending them to Settings later.
  - OB-8 (P2, AD) Language: if the device locale is Hindi, start in Hindi; show a small "English / हिन्दी" switch on slide 1.
- **Animations** OB-9: horizontal swipe between slides (DM), dot → pill morph, icon scale-in 0.9 → 1 with fade.
- **Icons** OB-10: slide 1 app mark; slide 3 `ScanLine`; slide 4 `ShieldCheck` + `HardDriveDownload`.

---

## VH. Documents (vault home)

Screens: `05` empty, `09`–`13` list/grid/compact, `14` search.

- **Bugs**
  - VH-1 (P1) **Search bar has a second box peeking out on its right** — `.kg-vault__search-row` still has the old fill, radius and `padding-inline-end` from before the field got its own box (b7dee6b). Remove the row's fill/radius/padding.
  - VH-2 (P1) **The FAB covers the last row's star** (dark screenshot `09`): the list has no bottom padding for the FAB. Add `padding-bottom: FAB size + 2 × space-4`.
  - VH-3 (P2) The lone "∨" button next to "Date added" has no label — it is the sort-direction toggle but reads as "expand". Use `ArrowDownWideNarrow` / `ArrowUpNarrowWide` with an `aria-label` and tooltip-style label.
- **Visual bugs**
  - VH-4 (P1) **PDF thumbnails are white squares on white cards** — no edge, they disappear (light). Give `DocumentThumb` a 1 px `--border-default` edge.
  - VH-5 (P1) **Grid card actions pill covers the thumbnail** (⋮ and ☆ on a translucent pill over the image; in dark it's a heavy grey blob). Put actions below the image beside the name, or show ☆ only (⋮ via long-press/menu).
  - VH-6 (P1) Landscape cards (PAN, Aadhaar) are cropped by `object-fit: cover` in portrait tiles — the important text is cut ("AR (FRONT)"). Use `contain` on a `--surface-2` matte for images; keep `cover` for PDF pages.
  - VH-7 (P2) Selected view-mode pill is white on a light-grey track — low contrast for the current state; use `--surface-1` + border + saffron icon.
- **Borders · sizing · spacing**
  - VH-8 (P1, PD) **Two rows of controls before any document** (Filter + Sort + direction, then View mode): ~140 px. Merge into one toolbar row: `Filter · Sort ▾ · ⇅ · [≡ ▦ ☰]`.
  - VH-9 (P2) Filter is a borderless ghost button while Sort is a filled select of a different height (40 vs 48 px). Same height and style for both (chip-style buttons, 40 px, radius-full).
  - VH-10 (P2) List rows: 16 px side padding on the page + 12 px inside the card + 40 px thumb → good; but rows are 64 px tall with 8 px gaps while compact rows are 44 px with 6 px — define `--row-h` per density (already in tokens) and use it.
  - VH-11 (P2) Header (`--surface-2`) and page (`--surface-1`) differ by one step only; add a hairline bottom border to the header on scroll (Material "scrolled" state).
- **Next-best actions**
  - VH-12 (P1, NBA·GoE) Empty state's only button is "Set up starter folders". The first thing a new user wants is to **add a document**: primary **Scan document**, secondary **Upload**, tertiary link "Set up folders".
  - VH-13 (P1, NBA·AD) After search with no exact match, offer **"Ask AI to find 'rent'"** (it can search inside text) — the gulf between "I can't find it" and the AI is one tap.
  - VH-14 (P2, AD) Suggestion chips above the list from on-device signals: "Expiring soon" (when expiry metadata exists), "Recently added", "Unsorted (no folder)".
  - VH-15 (P2, NBA) Long-press a card → multi-select is hidden knowledge; show a one-time hint after the 3rd document ("Long-press to select several").
- **Improvements**
  - VH-16 (P2, DM) Swipe actions exist but are invisible — show a 1-time peek animation on the first row.
  - VH-17 (P2, Hook) Pull-to-refresh is meaningless offline; instead pull-down reveals search (PD) on long lists.
- **Animations** VH-18: list item enter (fade + 8 px rise, 40 ms stagger), view-mode change cross-fade, favourite star pop (scale 1 → 1.3 → 1 + colour fill), delete → collapse row height with undo toast.
- **Icons** VH-19: sort direction icons (VH-3); file-type icons distinguish PDF vs image already — add `FileSpreadsheet`/`FileType` for xlsx/docx outputs.

---

## UP. Add a document (FAB, upload sheet, rename prompt)

Screens: `06` FAB open, `07` sheet, `08` rename prompt.

- **Bugs**
  - UP-1 (P1, GoE) **Adding 5 files queues 5 rename prompts**, one after another. For multi-adds: one sheet listing all names (editable inline) or skip the prompt.
- **Visual bugs**
  - UP-2 (P1) **FAB speed-dial mini buttons are icon-only** (document, folder+, upload) — users can't tell them apart. Add labels to the left of each mini FAB.
  - UP-3 (P2) Upload sheet: options are centred saffron text with icons, the title is left-aligned — mixed alignment; and the sheet is 60 % of the screen for 3 rows (big empty bottom).
- **Borders · sizing · spacing**
  - UP-4 (P2) Sheet rows: make them 56 px list rows, left-aligned, icon in a 40 px tinted circle (`--color-primary-subtle`), title + one-line hint ("Best for paper documents"), sheet height = content.
- **Next-best actions**
  - UP-5 (P1, NBA) Put **Scan** first and mark it recommended — it gives the cleanest PDF; on web it's hidden, so the web order is Files, Gallery, Camera.
  - UP-6 (P2, AD) If the clipboard/share intent just delivered a file, offer "Add the file you just shared".
  - UP-7 ✅ One added document → toast **Open / Ask AI** (6a77e24).
- **Animations** UP-8: FAB rotates + → ×, mini buttons fan out with 30 ms stagger; upload progress as a thin bar under the header instead of a block.
- **Icons** UP-9: mini FABs `ScanLine` (scan), `FolderPlus` (new folder), `Upload` (files) — current `File` icon for "scan" is wrong.

---

## IM. Document menu (⋮ sheet)

Screen: `15`.

- **Visual bugs / sizing**
  - IM-1 (P1, PD) **13 items in one flat list** (Rename, Add tag, Move, Select, Lock, Details, Copy text, Compress, Extract pages, Save page as image, Archive, Delete) — the sheet fills the screen and the likely actions are not first.
  - IM-2 (P2) Title (document name) is centred, rows are left-aligned.
- **Next-best actions**
  - IM-3 (P1, NBA·PD) Top row of 4 big quick actions with labels: **Share · Open with · Ask AI · Favourite**; then a short list: Rename, Move, Tags, Details; then a "Tools" group (Compress, Extract pages, Save as image, Copy text) collapsed under **More tools ›**; Lock, Archive, Delete at the bottom.
  - IM-4 (P2) "Select" doesn't belong in a single-document menu (long-press already selects).
  - IM-5 (P2, AD) Order the tool group by file type: PDF → Compress, Extract; image → Enhance, Convert, To PDF.
- **Animations** IM-6: sheet spring-in; quick-action buttons press scale 0.96.
- **Icons** IM-7: `Share2`, `ExternalLink`, `Sparkles`, `Star` for the quick row.

---

## FP. Filter panel

Screen: `16`.

- **Visual bugs / sizing**
  - FP-1 (P1, A11y) **Filter chips are ~24 px tall** (PDF / Images / Other, size ranges) — below the 44 px touch target. Use 40 px chips with 8 px gaps.
  - FP-2 (P1, A11y) Unselected chip = `--surface-2` on `--surface-1` (≈1.1:1) with no border — chips look like text. Add 1 px `--border-default`; selected = `--color-primary-subtle` + saffron border + check icon.
  - FP-3 (P2) Toggle off-track is very light grey (fails 3:1 UI contrast).
  - FP-4 (P2) Sheet is full-height with the content in the top third. Fit to content.
- **Next-best actions**
  - FP-5 (P2, NBA) Show the live result count on Apply ("Show 3 documents") so they know before applying; disable when 0.
- **Animations** FP-6: chip select fills from the centre; count number ticks.

---

## DR. Side drawer

Screen: `17`.

- **Visual bugs / sizing**
  - DR-1 (P2) Header is just the text "Kagazzz Docs" in a toolbar — add the app mark (32 px) + name + a one-line "Private · on this phone" reassurance.
  - DR-2 (P2) No current-page highlight (on Trash, "Trash" should be tinted `--color-primary-subtle`).
  - DR-3 (P2) Drawer is 75 % wide (304 px); Material recommends ≤ 360 px and ≥ 56 px scrim on the right — fine; but items are 48 px with 16 px icon gap — use 56 px rows for a calmer list.
- **Next-best actions**
  - DR-4 (P2, NBA) Show counts where they guide action: Trash "3", Archived "2". A "Backup" entry with "Last backup: never" nudges the most important safety action (Hook: investment).
- **Animations** DR-5: items slide in 8 px with a 20 ms stagger on open.
- **Icons** DR-6: ✅ labelled icons; add `DatabaseBackup` for Backup.

---

## VW. Document viewer

Screens: `18`–`23` (PDF, image, menu).

- **Bugs**
  - VW-1 (P1) **On web/unsupported devices the next-actions row is a single full-width gradient "More"** (Share and Ask AI are hidden) — "More" becomes the screen's primary CTA. When only "More" is left, hide the row (the ⋮ in the header already does it).
  - VW-2 (P1) Image documents say "No text extracted. Extraction works on images, scans, and PDFs." — contradictory on an image. Show **Extract text** (button) or, where OCR isn't available, "Text extraction runs on the phone app".
- **Visual bugs**
  - VW-3 (P1) PDF page is edge-to-edge white with no page frame — in light mode it merges with the background; in dark it's a blinding white block. Pages on a `--surface-2` canvas with 12 px margin, `--shadow-md`, page number "1 / 3" under each.
  - VW-4 (P1) Viewer shows the tab bar **and** the actions row (see G-2).
  - VW-5 (P2) Extracted text is one run-on paragraph (line breaks lost).
- **Borders · sizing · spacing**
  - VW-6 (P2) Extracted-text panel: 16 px padding, but "Copy text" is a full-width outline button — make it an icon button in the panel header; number chips are 28 px tall (A11y: 44 px).
- **Next-best actions**
  - VW-7 ✅ Share / Ask AI / More row (6a77e24).
  - VW-8 (P1, NBA·AD) File-type aware actions: PDF → **Compress**, **Extract pages**; image → **Enhance**, **Make PDF**; ID card detected (OCR text matches PAN/Aadhaar pattern) → **Save to Quick Reference** (copies the number into the locked store).
  - VW-9 (P2, NBA) Detected numbers: tapping a chip copies; add "Save to Quick Reference" on long-press.
  - VW-10 (P2, DM) Pinch-to-zoom and double-tap zoom on pages; swipe left/right to the next document in the list.
- **Animations** VW-11: shared-element transition from the list thumbnail to the page; page fade-in as it renders.
- **Icons** VW-12: `Copy` in the panel header, `ZoomIn` hint.

---

## FV. Favorites

Screen: `24`.

- **Bugs / visual**
  - FV-1 (P1) Rows have ☆ but **no ⋮ menu** — inconsistent with Documents; the same row component should look the same everywhere.
  - FV-2 (P2) Empty state has no action.
- **Next-best actions**
  - FV-3 (P2, NBA) Empty state: **Browse documents** button; suggest "Star your Aadhaar and PAN — you'll need them often" (AD: suggest documents whose names match common IDs).
  - FV-4 (P2, DM) Long-press drag to reorder favourites (they're "my most-used", order matters).
- **Animations** FV-5: unstar → row collapses with undo toast.

---

## ST. Storage

Screens: `25`–`26`.

- **Bugs**
  - ST-1 (P1) **"5 document(s)"** — fake pluralisation. Use i18n plurals (`document_one` / `document_other`).
- **Visual bugs**
  - ST-2 (P2) Donut is 200 px for a two-segment chart with a 98 % slice — it dominates the page and says little. Replace with a horizontal stacked bar + legend; total as the page headline.
  - ST-3 (P2) "Largest documents" rows look like plain text — no affordance that they are tappable.
- **Borders · sizing · spacing**
  - ST-4 (P2) Sections are flat on the page while other pages use cards — put "By type" and "Largest" in cards with 16 px padding.
- **Next-best actions**
  - ST-5 (P1, NBA) Each large document row: tap → open; trailing **Compress** (PDF) / **Resize** (image) action with "save ~X KB". Header action **Free up space** = empty Trash (with size) + compress suggestions.
  - ST-6 (P2) Show the AI model's 2.6 GB as its own line with **Manage** (it's usually the biggest item).
- **Animations** ST-7: bar segments grow in on load; numbers count up.
- **Icons** ST-8: per-type icons in the legend instead of dots.

---

## PT. PDF Tools hub

Screens: `27`–`28`, `48`–`49`.

- **Visual bugs**
  - PT-1 (P2) Cards have uneven heights (2- vs 3-line descriptions) → ragged grid. Equal min-height; clamp description to 2 lines.
  - PT-2 (P2) The **Tools tab icon is `FileText`** — same glyph as "PDF → Text". Use `Wrench` / `LayoutGrid`.
  - PT-3 (P2) Subtitle wraps with a one-word orphan ("device").
- **Borders · sizing · spacing**
  - PT-4 (P2) Category chips 40 px with the "All" chip filled + glow — the glow over-emphasises a filter. Use the shared segmented/chip style (G-6).
- **Next-best actions**
  - PT-5 (P1, AD·NBA) **History is at the very bottom, after 18 cards.** Put a "Recent" row of the last 3 used tools at the top (one tap to reopen with the last document pre-selected); full history stays at the bottom.
  - PT-6 (P2, PD) Group cards under headings (Combine & split · Convert · Protect & sign · Edit) instead of one 18-card wall; the category chips already exist — make "All" show the grouped layout.
- **Animations** PT-7: card press scale 0.97; sheet opens from the tapped card (container transform).
- **Icons** PT-8: ✅ object-role saffron icons; `Wrench` for the tab.

---

## TS. Tool sheets (all 18 tools)

Screens: `29`–`47`.

- **Bugs**
  - TS-1 (**P0**) **Compress output was rejected when saving and the user saw nothing**: the sheet closed, no result sheet, no error, no history (console: `vault.upload.failed` 1 ms after `engine.request.success`, web demo). Two defects: the save failure itself (validation reject — investigate the output blob) and the silent UI (a failed save must keep the sheet open with an error and record a failed run).
- **Visual bugs**
  - TS-2 (P1) **Dark sheets are `#1e1e1e` grey** (G-1).
  - TS-3 (P1) **Unselected tile badge is a solid grey dot** — reads as a status light, not a checkbox. Use an empty 24 px circle with a white 2 px ring.
  - TS-4 (P2) **Compress "Quality" label is top-aligned** while the options are vertically centred (8 px off); options are loose text buttons (G-6).
  - TS-5 (P2) Disabled **Run** is a washed-out salmon with white text (light) / brown with dark text (dark) — readable but looks broken. Use the standard disabled style (`--surface-3` fill, `--text-muted` text) and a hint above it.
- **Borders · sizing · spacing**
  - TS-6 (P2) Tiles are 106 × 140 with 12 px gaps in a 3-column grid that leaves a 60 px gap at the right on 412 px — use `repeat(auto-fill, minmax(96px, 1fr))` with the page padding so columns fill the width.
  - TS-7 (P2) 16 px under the tile name, then 40 px to "Recent runs" — tighten to a consistent 24 px section gap.
- **Next-best actions**
  - TS-8 (P1, GoE) **No instruction**: Merge doesn't say "pick 2 or more, in order"; Split/Extract don't say ranges are asked next. One helper line under the title per tool.
  - TS-9 (P1, AD) Pre-select when the context is clear: opened from a document's menu / viewer → that document is pre-selected; only one candidate → pre-selected.
  - TS-10 (P2, PD) "Recent runs of this tool — Nothing yet" in every sheet is noise for new users. Hide the section until the tool has run once.
  - TS-11 ✅ Result sheet Open / Share (6a6b840) — but see TS-1.
- **Animations** TS-12: tile select = check pops in + ring draws; Run → progress bar grows from the button; result sheet slides up from the Run button.
- **Icons** TS-13: per-tool icon next to the sheet title (same as its card).

---

## QR. Quick Reference

Screen: `50`.

- **Visual / spacing**
  - QR-1 (P2) Two Add buttons (header ＋ and the empty-state "Add") — fine for empty, but the empty-state button is a small 70 px pill with glow; make it a full-width-ish primary (G-8).
- **Next-best actions**
  - QR-2 (P1, NBA·AD) Empty state: offer **"Add PAN from your PAN Card document"** when a document named/OCR-matched as PAN exists (on-device) — one tap fills the value.
  - QR-3 (P2, NBA) After copying a value, the toast offers **Open WhatsApp/Messages?** — no; keep it simple: toast "Copied · Paste anywhere" (current) is right (YAGNI).
- **Icons** QR-4: empty icon `Copy` → `KeyRound` (matches the drawer).

---

## QN. Quick Notes

Screen: `51`.

- QN-1 (P2) Warning banner is good (safety); in dark mode its tint is muddy brown — use `--color-warning` at 12 % over `--surface-2`.
- QN-2 (P2, NBA) If a note looks like an ID number (12 digits, PAN pattern), offer **Move to Quick Reference** (locked).
- QN-3 (P2) Empty icon `File` → `StickyNote` (matches the drawer).

---

## AR. Archived · TR. Trash

Screens: `52`–`53`.

- TR-1 (P1, A11y) Hint and "Trash is empty" use `--text-muted` (2.4:1) — G-3.
- TR-2 (P2, NBA) Non-empty Trash: header action **Empty trash (X MB)**; each row shows "Deletes in N days".
- AR-1 (P2, NBA) Archived rows: swipe → **Unarchive** as the primary action.
- Both: (P2) empty states get the shared `EmptyState` (G-8).

---

## AI. AI model page · AI chat

Screens: `54`–`55` (web shows the "unsupported" state; the real states need a device pass).

- AI-1 (P2) Unsupported message is plain centred text with a small icon; say **why** and **what still works**: "On-device AI needs an Android phone with … — everything else in the app works without it."
- AI-2 (P1, device pass) Audit the real states on a phone: download progress, loading, ready, chat with links/preview (f8e58b3), the centre AI tab.
- AI-3 (P2, NBA) Chat empty state: 3 suggestion chips built from the vault ("Find my rent agreement", "Merge my Aadhaar front and back", "What's my PAN number?") — anticipatory, on-device.

---

## LG. Legal pages (privacy, terms, licenses)

Screens: `56`–`57`.

- LG-1 (**P0**, compliance) **Privacy policy is out of date and contradicts the app**: titled "Kagaz (Omni Docs)", placeholder contact `legal@omnidocs.example (replace before launch)`, and describes DigiLocker import, share links, India-hosted backups and *analytics providers* — none of which V1 has (V1 makes no network calls except the AI model download). Store reviewers read this. Rewrite for Kagazzz Docs V1 (tracked as a store-readiness item; needs counsel review).
- LG-2 (P2) Long legal text has no TOC / headings styling — headings render as plain lines ("1. Who we are"). Style h2/h3, add an in-page TOC.
- LG-3 (P2) Licenses list: package names wrap mid-name; put the version on its own muted line, licence as a chip.

---

## SE. Settings

Screens: `58`–`60`.

- **Visual bugs**
  - SE-1 (P1) **Toggles are green** (`--color-accent`) while every other "on/selected" state is saffron (icon roles, b7dee6b). Toggle on = `--icon-active`.
  - SE-2 (P1) **Navigation rows are full-width outline buttons** (Trash, Archived, Export, Restore, Privacy, Terms, Licenses) — they look like actions of equal weight. Use list rows with leading icon, title, hint, trailing chevron.
  - SE-3 (P1) **"Delete all data" is a big filled red button** in the middle of the page — the most destructive action has the strongest visual weight. Move to a "Danger zone" at the very bottom as an outline/ghost danger row (the confirm dialog stays).
- **Borders · sizing · spacing**
  - SE-4 (P2) Swipe-action pickers wrap to two rows of six outline pills each — use a `Select` (one row each) or the shared segmented control with icons.
  - SE-5 (P2) Sections are separated only by uppercase headers; group each section in a card (Material settings pattern) with 8 px between rows, 24 px between sections.
- **Next-best actions**
  - SE-6 (P1, NBA·Hook) **Backup nudge**: show "Last backup: never" with **Back up now** at the top of Settings until a backup exists — it's the one action that protects everything.
  - SE-7 (P2, PD) Rarely-changed settings (swipe actions, haptics) under an "Advanced" section, collapsed.
  - SE-8 (P2) Trash and Archived duplicated here and in the drawer — keep them in the drawer only (one place each).
- **Icons** SE-9: leading icons per row (`Languages`, `Palette`, `Hand` for swipe, `Vibrate`, `Fingerprint`, `DatabaseBackup`, `Trash2`).

---

## Fix order

Grouped so each batch is one coherent commit and reuses one shared piece (DRY):

1. **P0** — G-1 dark palette bridge · M-1/M-2/M-3 contrast tokens · M-10 button font inheritance · TS-1 silent save failure · LG-1 privacy policy (draft for counsel).
2. **Shared primitives** (unblocks most P1/P2): `Button sm` = 44 px (M-7), `EmptyState` (G-8), `SegmentedControl` (G-6), settings/list row (SE-2), chip size + contrast (FP-1/2), `formatShortDate` (G-4), `DocumentThumb` edge + `contain` for images (VH-4/6).
3. **Shell & layout** — G-2 tab bar only on roots · G-5 toasts above tabs · VH-1 search row · VH-2 FAB padding · VH-8 one toolbar row · VW-1 hide lone "More".
4. **Next-best actions** — OB-6 · VH-12 · VH-13 · UP-2/5 · IM-3 · VW-8 · ST-5 · PT-5 · TS-8/9 · SE-6.
5. **Contrast & polish** — G-3 · OB-2 · TR-1 · SE-1 · SE-3 · ST-1.
6. **Motion** — G-10 per-page animations, reduced-motion aware.
7. **Device pass** — native-only flows and the AI states (AI-2), Hindi layout.
