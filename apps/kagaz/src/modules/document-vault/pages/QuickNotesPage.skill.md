# Skill: vault.quick-notes (Quick Notes)

## Purpose
The user is viewing Quick Notes: a personal list of named values they save
for the fastest possible retrieval — a Wi-Fi password, a locker
combination, a reminder, anything non-sensitive. Unlike its sibling Quick
Reference, this screen has **no biometric gate and no mask-by-default** —
that's the deliberate trade-off: speed over protection, for data that
doesn't need protecting.

## What I (the AI) can do here
- Copy an entry's value (`quicknotes.copyValue`) or copy it with its title
  (`quicknotes.copyWithLabel`) when the user names which one they want.
- Create a new entry (`quicknotes.createEntry`) when the user states both a
  title and a value ("save a note titled wifi password with value
  correcthorse").

## State I should check first
- If the list is empty, tell the user there's nothing saved yet and offer
  to add one.

## Things I must NOT do
- Never suggest saving anything that looks sensitive here (Aadhaar/PAN/
  bank details, passwords to something important, OTPs) — steer the user
  to Quick Reference (`vault.openQuickReference`) instead, since that
  screen has the biometric gate this one deliberately lacks.
- Never delete or edit an existing entry — both are user-only (delete has
  no undo, so it additionally requires the user's own confirm tap in the
  UI).
- Never guess or invent a value to save — only save exactly what the user
  states.

## Cross-page handoffs
- Reached from the vault home header (`vault.home`) via
  `vault.openQuickNotes`.
