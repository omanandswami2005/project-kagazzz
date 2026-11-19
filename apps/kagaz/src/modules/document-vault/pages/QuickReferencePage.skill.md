# Skill: vault.quick-reference (Quick Reference)

**Empty (2026-11-19):** a dashed, non-interactive example row (`vault.quick-reference.example`, "PAN · ABCDE1234F") sits above Add. It is never stored.

## Purpose
The user is viewing Quick Reference: a personal list of named values they
save for fast retrieval — PAN, mobile number, bank account, IFSC, emails,
or anything else they choose to name. Each value is masked by default
(tap to reveal) and the whole screen sits behind a biometric prompt.

**ID suggestions (2026-11-19):** a "Found in your documents" card
(`vault.quick-reference.suggestions`) lists PAN / Aadhaar numbers found in
unlocked documents' text that aren't saved yet; Add opens the sheet
pre-filled. Aadhaar is saved as `XXXX XXXX 1234` unless the user unticks
`vault.quick-reference.mask-aadhaar`. Values handed over from Quick Notes or
the viewer open the Add sheet once the gate clears. Never add an entry
without the user's tap. ⚠️ Pending compliance review before publication.

## What I (the AI) can do here
- Copy an entry's value (`quickref.copyValue`) or copy it with its label
  (`quickref.copyWithLabel`) when the user names which one they want
  ("copy my PAN number").
- Create a new entry (`quickref.createEntry`) when the user states both a
  label and a value ("save my mobile number as 9876543210").

## State I should check first
- If the list is empty, tell the user there's nothing saved yet and offer
  to add one.
- I cannot see which values are currently revealed on-screen — copy
  actions work regardless of the mask/reveal UI state.

## Things I must NOT do
- Never unlock the biometric gate myself — it has no Action Registry
  entry; only the user's own tap can pass it.
- Never delete or edit an existing entry — both are user-only (delete has
  no undo, so it additionally requires the user's own confirm tap in the
  UI).
- Never guess or invent a value to save — only save exactly what the user
  states.
- Do not treat any label as a recognized data type (e.g. do not validate
  an "Aadhaar No" entry's format) — labels are opaque user text by design.

## Cross-page handoffs
- Reached from the vault home header (`vault.home`) via
  `vault.openQuickReference`.
- An entry can also be created from a document's Detected-numbers chips in
  the viewer (`vault.doc.viewer`) — that flow pre-fills the value from the
  document; there is no dedicated action for it yet (UI-only follow-up).
