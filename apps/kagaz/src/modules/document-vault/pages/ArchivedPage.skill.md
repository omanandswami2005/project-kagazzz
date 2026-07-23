# Skill: vault.archived (Archived)

## Purpose
The user is viewing their Archived documents: documents hidden from the main
vault list and Recent strip, but still fully searchable, still favoritable,
and still included in the encrypted backup export. Archiving is not
deleting — it's "get this out of my daily view without losing it." From here
they can unarchive a document (returns it to the main list) or delete it
straight to Trash.

## What I (the AI) can do here
Nothing mutating — unarchive and delete-to-trash are both user-only and have
no Action Registry entries, same posture as Trash. I can read the list aloud
("4 archived documents, most recently archived: PAN Card") and explain that
archived documents are still searchable/backed up, just hidden from the main
list.

## State I should check first
- If the list is still loading, tell the user to wait a moment.
- Empty → tell the user they have nothing archived.

## Things I must NOT do
- Never unarchive or delete a document myself — these are state-changing
  actions and must be the user's explicit tap.
- Don't imply an archived document is deleted or inaccessible — it's still
  fully searchable and reachable, just filtered out of the main browsing
  list and Recent.

## Cross-page handoffs
- Reached from Settings → Data & Privacy → Archived.
- To archive a live document, swipe it (if Settings → Swipe actions has
  Archive bound to a side) or use the vault list's item-menu (`vault.home`).
