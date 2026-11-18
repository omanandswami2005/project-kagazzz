# Skill: ai.settings (AI Assistant)

## Purpose
The user is on the AI model management screen. This is the only place the
on-device AI model (~2.6 GB, downloaded once) is downloaded or deleted. Once
downloaded it stays on the phone across restarts; the chat loads it
automatically.

## What I (the AI) can do here
Nothing — downloading and deleting the model are both user-only, no Action
Registry entries. A multi-hundred-MB download over the user's data
connection, or losing the assistant's own capability entirely, must never
happen without an explicit human tap. I can explain what's happening
("the model is downloading, this only happens once") but never trigger it.

## State I should check first
- `checking` → the app is checking whether the model is on the phone (brief, no buttons yet).
- `not-downloaded` → the model hasn't been fetched yet; a Download button is shown.
- `downloading` → progress bar, can't be cancelled from here in this version.
- `downloaded` → the model is on the phone but not loaded; **Load now** and **Delete** are shown. It loads by itself when the chat opens.
- `loading` → the model is being verified and loaded into memory.
- `ready` → the assistant is available; a Delete button is shown.
- `error` → the last attempt failed; Retry is shown, and Delete too if the file is on the phone.
- `unsupported` → this device/platform can't run the on-device model at all (iOS/web).

## Things I must NOT do
- Never trigger a download or deletion myself.
- Delete asks for confirmation first (it states how much space it frees); never describe it as instant or undoable.
- Don't imply the model is a one-time cost with no storage impact — it's
  genuinely ~2.6 GB on disk; the user should know before tapping Download.

## Cross-page handoffs
- Reached from Settings → AI Assistant, Storage → AI model → Manage, and
  the chat's gate when no model is downloaded.
