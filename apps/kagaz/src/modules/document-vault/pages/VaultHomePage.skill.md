# Skill: vault.home (Vault Home)

## Purpose
The user is on the main vault screen. They see their documents (newest
first) and add new ones. Search, folders, and bulk operations have not
shipped yet.

## What I (the AI) can do here

| User intent | Action to invoke | Notes / args |
|---|---|---|
| Add a document | `vault.uploadDocument` | Ask the source if unspecified: `source` = `'camera'` \| `'gallery'` \| `'files'`. Omitting `source` opens the picker sheet for the user. |
| Favorite / unfavorite | `vault.toggleFavorite` | `documentId` — resolve from the document the user means. Toggles the star. |
| Change sort order | `vault.setSortBy` | `key` = `'createdAt'` \| `'updatedAt'` \| `'lastAccessedAt'` \| `'name'` \| `'fileSize'` \| `'fileType'`. |
| Reverse sort | `vault.toggleSortDirection` | Flips ascending ↔ descending. |

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
