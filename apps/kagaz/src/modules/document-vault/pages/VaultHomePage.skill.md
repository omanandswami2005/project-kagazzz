# Skill: vault.home (Vault Home)

## Purpose
The user is on the main vault screen. They see their documents (newest
first), search, folders and recents, and add new ones (upload button,
bottom-right).

**Navigation (2026-11-19):** ☰ at the top right opens the side drawer (it slides in from the right)
(`app.menu`): Quick reference, Quick notes, Archived, Trash, AI model,
Settings, Privacy policy. The AI chat is the raised centre button of the tab
bar (`app.tab.ai`), not a header icon.

**First run (2026-11-19):** a 3–4 step spotlight tour (`app.tour`, buttons
`app.tour.next/back/close`) shows once: add, search, the assistant, the
drawer. Once documents exist, a **Getting started** card
(`vault.home.getting-started`) lists five steps, each ticked by real state:
add a document, make a folder, star one, lock the app, make a backup. The
folders section (`vault.home.folders-toggle`) collapses like Recent and is
open again on every launch. While the list scrolls, a date pill
(`vault.home.scroll-date`) shows when the top visible document was added.

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| Add a document | `vault.uploadDocument` | Ask the source if unspecified: `source` = `'camera'` \| `'gallery'` \| `'files'`. Omitting `source` opens the picker sheet for the user. |
| Open PDF tools | `tools.openPdfTools` | Opens the PDF Tools hub (merge, split, compress, PDF↔image, password protect/unlock, fill form). Pass `op` to jump straight to one tool. |
| Open Quick Reference | `vault.openQuickReference` | Opens the personal saved-values screen (PAN, mobile, bank account, etc.) — behind its own biometric gate. |
| Open Quick Notes | `vault.openQuickNotes` | Opens the fast, gate-free notes screen. For non-sensitive data only — never suggest storing an ID number, password, or anything sensitive here. |
| Take a quick note | `vault.startQuickNote` | Opens Quick Notes with the add-note composer already open — for when the user wants to write a note immediately, not just browse the list. Same non-sensitive-data caveat as above. |
| Find a document | `vault.searchDocuments` | `query` — keywords from the user. Full-text over name/description/OCR; results replace the list while the query is active. |
| Filter the list | `vault.openFilters` | Opens the filter panel (type / size / tags / favorites). |
| Remove filters | `vault.clearFilters` | Clears every active filter. |
| Delete selected (bulk) | `vault.bulkDelete` | Soft-deletes the multi-selected documents. Destructive — confirm the count first. |
| Favorite selected (bulk) | `vault.bulkFavorite` | Stars the multi-selected documents. |
| Favorite / unfavorite | `vault.toggleFavorite` | `documentId` — resolve from the document the user means. Toggles the star. |
| Create a folder | `vault.createFolder` | `name`. Created inside the folder the user is currently viewing. |
| Set up starter folders | `vault.createStarterFolders` | One-tap default set (Identity, Education, Financial, Health, Property, Employment, Misc). Best for an empty vault. |
| Move a document | `vault.moveDocument` | `documentId` + `folderId` (`null` = vault root). |
| Edit a document's tags | `vault.manageTags` | `documentId`. Opens the tag editor sheet. |
| Tag a document | `vault.tagDocument` | `documentId` + `tag` (label). Creates the tag if new, then assigns it. |
| Change sort order | `vault.setSortBy` | `key` = `'createdAt'` \| `'updatedAt'` \| `'lastAccessedAt'` \| `'name'` \| `'fileSize'` \| `'fileType'`. |
| Reverse sort | `vault.toggleSortDirection` | Flips ascending ↔ descending. |
| Archive a document | `vault.archiveDocument` | `documentId`. Hides it from the main list and Recent — still searchable, favoritable, and backed up. Reversible from the Archived view (Settings → Data → Archived), no confirmation needed. |

Documents can also be moved between swipe-left/swipe-right by the user in
Settings → Swipe actions (delete/favorite/move/add-tag/archive/none per
side) — swiping is a direct manipulation with no dedicated action id of its
own; it dispatches whichever of the actions above the user configured.

Supported upload formats: PDF, JPG, PNG, HEIC, WEBP. Max 100 MB per
file.

## State I should check first
- `isLoading === true` → the list is still loading; don't act yet.
- `isUploading === true` → an upload batch is running; wait for it.
- `documentCount === 0` → empty vault; offer to upload a first document.
- `isUploadSheetOpen === true` → the source sheet is already open; the
  user may pick manually.

## Voice examples I should recognize
- "upload a document" → `vault.uploadDocument({})`
- "take a photo of my document" → `vault.uploadDocument({ source: 'camera' })`
- "दस्तावेज़ अपलोड करो" → `vault.uploadDocument({})`
- "गैलरी से फोटो जोड़ो" → `vault.uploadDocument({ source: 'gallery' })`
- "take a quick note" → `vault.startQuickNote({})`
- "एक क्विक नोट लिखो" → `vault.startQuickNote({})`

## Things I must NOT do
- Read document content — I only see metadata (name, type, size, dates).
- Promise scanning, search, folders, or sharing; those features have not
  shipped yet.
- Retry a failed upload more than once without asking the user.

## Error messages to the user
When `vault.uploadDocument` fails per file (shown as a toast):
- `INVALID_FILE_TYPE` → "That file type isn't supported. Use PDF, JPG, PNG, HEIC, or WEBP."
- `FILE_TOO_LARGE` → "Files must be under 100 MB."
- `STORAGE_FULL` → "Your device is low on storage — free some space first."
- `CORRUPTED_FILE` → "That file looks damaged. Try re-exporting it."

## Cross-page handoffs
- None yet — this is currently the only screen.
