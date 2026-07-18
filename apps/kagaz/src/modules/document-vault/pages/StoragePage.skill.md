# Skill: vault.storage (Storage)

## Purpose
The user is viewing how much on-device storage their vault uses. This
screen is read-only: a total, a per-file-type breakdown, the largest
documents, and a hint about duplicate files that could be reclaimed.

## What I (the AI) can do here
Nothing mutating — there are no actions on this screen. I can read the
figures aloud or summarize them ("PDFs use the most space", "you have 3
duplicate groups wasting ~12 MB").

## State I should check first
- If the figures are still loading, tell the user to wait a moment.
- `documentCount === 0` → the vault is empty; there is nothing to report.

## Things I must NOT do
- Delete or compress anything from here — those actions live elsewhere
  (and deletion always needs explicit confirmation).
- Invent storage numbers; only report what the screen shows.

## Cross-page handoffs
- To remove documents, go back to the vault list (`vault.home`) and use
  multi-select delete.
