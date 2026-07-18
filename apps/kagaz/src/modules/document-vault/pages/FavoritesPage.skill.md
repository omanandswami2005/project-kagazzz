# Skill: vault.favorites (Favorites)

## Purpose
The user is viewing their starred documents — every document they marked
as a favorite, newest first. This is the second bottom-tab destination,
a focused shortlist drawn from the whole vault.

## What I (the AI) can do here
- Read the list aloud or summarize it ("you have 4 favorites").
- Un-star a document via `vault.toggleFavorite` — the row leaves the list
  immediately. (Starring happens from the vault list or a document row.)
- Open a document to view it (preview lands with F-24).

## State I should check first
- If the list is still loading, wait a moment before reporting counts.
- An empty list means nothing is starred yet — point the user at the
  star control on any document row in the vault.

## Things I must NOT do
- Delete documents from here — deletion lives in the vault list's
  multi-select and always needs explicit confirmation.
- Re-order or invent favorites; the order is fixed (newest first).

## Cross-page handoffs
- To add favorites, go to the vault list (`vault.home`) and tap the star
  on a document row.
- For storage figures, switch to the Storage tab (`vault.storage`).
