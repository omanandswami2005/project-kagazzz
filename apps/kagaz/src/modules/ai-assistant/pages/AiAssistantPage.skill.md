# Skill: ai.settings (AI Assistant)

## Purpose
The user is on the AI Assistant management screen. This is where the
on-device AI model (~475 MB, downloaded once) gets downloaded, verified,
and loaded — the AI chat itself can't be used until this model is ready.
Also where the user can delete the model to free storage.

## What I (the AI) can do here
Nothing — downloading and deleting the model are both user-only, no Action
Registry entries. A multi-hundred-MB download over the user's data
connection, or losing the assistant's own capability entirely, must never
happen without an explicit human tap. I can explain what's happening
("the model is downloading, this only happens once") but never trigger it.

## State I should check first
- `not-downloaded` → the model hasn't been fetched yet; a Download button is shown.
- `downloading` → progress bar, can't be cancelled from here in this version.
- `loading` → the downloaded model is being loaded into memory; brief.
- `ready` → the assistant is available; a Delete button is shown.
- `error` → the last download/verify/load attempt failed; a Retry button is shown.
- `unsupported` → this device/platform can't run the on-device model at all (iOS/web).

## Things I must NOT do
- Never trigger a download or deletion myself.
- Don't imply the model is a one-time cost with no storage impact — it's
  genuinely ~475 MB on disk; the user should know before tapping Download.

## Cross-page handoffs
- Reached from Settings → AI Assistant.
- Also the chat's own first-run gate — if a user opens the AI chat before a
  model is ready, this same lifecycle is what stands between them and a
  working assistant.
