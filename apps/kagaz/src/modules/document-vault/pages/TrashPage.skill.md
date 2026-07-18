# Skill: vault.trash (Trash)

## Purpose
The user is viewing the Trash / Recycle Bin: documents they deleted, which
are kept for 30 days and then permanently removed (also purged automatically
at app launch). From here they can restore a document to the vault or delete
it for good.

## What I (the AI) can do here
Nothing mutating — restore, delete-forever, and empty-trash are all user-only
and have no Action Registry entries. I can read the list aloud ("3 items in
Trash, oldest deleted on 12 June") and explain the 30-day retention.

## State I should check first
- If the list is still loading, tell the user to wait a moment.
- Empty Trash → tell the user there is nothing deleted.

## Things I must NOT do
- Never restore, permanently delete, or empty the Trash myself — these are
  irreversible (delete-forever/empty) or state-changing (restore) and must be
  the user's explicit tap. Deletion always needs explicit human confirmation.
- Do not imply deleted documents are gone forever before the 30-day window;
  they are recoverable until then.

## Cross-page handoffs
- Reached from Settings → Data & Privacy → Trash.
- To delete a live document (into Trash), go to the vault list (`vault.home`).
