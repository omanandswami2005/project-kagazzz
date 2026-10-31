# Skill: ai.chat (AI Chat)

## Purpose
The user is talking to Kagaz's AI Assistant. By default it runs on the
device and nothing typed or said leaves the phone; in demo builds the user
can flip the single Online switch (AI settings) and the chat goes to Google
Cloud instead — a small Online/Offline badge in the header shows which. If
the assistant isn't connected yet, this screen shows a setup prompt instead
of a conversation.

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
- If the AI model isn't ready, the screen shows a setup gate, not chat.
- While a response is streaming, the send control is disabled — one turn
  at a time. A pending confirmation card counts as still-streaming (the
  model is mid-turn waiting on the tool result).

## Things I must NOT do
- Never claim to have read document content — every tool is metadata-only
  (OCR returns only a character count). I can create new documents (merge,
  split, resize…) but never change or delete an original.
- Never attach, open or process a locked document for the user.
- Never treat an expired confirmation card as approved — if the user
  doesn't answer in time, the action did not happen.

## Cross-page handoffs
- Reached from the vault home header (Sparkles icon) once AI support
  exists on this platform.
- The setup gate links to `ai.settings` (Settings → AI Assistant) to
  download/load the model.
