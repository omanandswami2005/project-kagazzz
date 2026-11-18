# Skill: ai.chat (AI Chat)

## Purpose
The user is talking to Kagaz's AI Assistant. It runs on the device (Gemma 4)
and nothing typed leaves the phone. If the model is already downloaded it
loads automatically when this screen opens ("Loading the AI model…"). If it
was never downloaded, the screen shows a short prompt with a **Manage AI
model** button instead of a conversation. This screen never downloads or
deletes the model.

The user can attach documents with the **+** button (pick from the vault or
upload new ones; locked documents are not offered). Attached documents show
as chips above the input and travel with the message — I get each one's
name, type and id (metadata only), so I never need to ask for an id. When a
tool creates documents, the chat shows a result card with an Open button
for each.

## What I (the AI) can do here
I am the thing generating replies here, not a separate actor observing the
screen — there's no `ai.chat`-owned action for another instance of me to
trigger. But the model itself can call tools mid-conversation (F-14/F-23):
read-only document lookups (`ai.listDocuments`/`ai.searchDocuments`,
metadata only — never content/OCR text) and pure-navigation tools
(`vault.openQuickReference`/`vault.openQuickNotes`/`vault.startQuickNote`/
`settings.open`/`tools.openPdfTools`) run immediately. Anything
`requiresConfirmation: true` (e.g. `vault.bulkDelete`) pauses instead — an
inline Yes/No card appears in the message list and the tool only runs if
the user taps confirm; declining or letting the card time out (~25s) sends
the model a "not done" result, never a silent success.

## State I should check first
- If the AI model isn't ready, the screen shows a gate, not chat (`ai.chat.gate`, its `data-agent-state` is the model status): loading, "download it first", downloading N%, or an error with Retry.
- The **+** in the top bar starts a new conversation (history is kept in the database; disabled while streaming or when the chat is empty).
- While a response is streaming, the send control is disabled — one turn
  at a time. A pending confirmation card counts as still-streaming (the
  model is mid-turn waiting on the tool result).

## Things I must NOT do
- Never claim to have read a document without calling `ai.readDocumentText`
  (it works on unlocked documents, on-device only; `ai.runOcr` returns only a
  character count). I can create new documents (merge,
  split, resize…) but never change or delete an original.
- Never attach, open or process a locked document for the user.
- Never treat an expired confirmation card as approved — if the user
  doesn't answer in time, the action did not happen.

## Cross-page handoffs
- Reached from the vault home header (Sparkles icon) once AI support
  exists on this platform.
- The gate links to `ai.settings` (the AI model management page) to
  download or delete the model.
