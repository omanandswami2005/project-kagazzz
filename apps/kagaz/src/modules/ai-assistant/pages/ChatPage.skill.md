# Skill: ai.chat (AI Chat)

## Purpose
The user is talking to Kagaz's on-device AI Assistant. Everything here
runs locally on the phone — nothing typed or said is sent anywhere. If the
AI model hasn't been downloaded/loaded yet, this screen shows a setup
prompt instead of a conversation.

## What I (the AI) can do here
Nothing programmatic yet — this pass ships the conversation itself, not
tool calling. I am the thing generating replies here, not a separate actor
observing the screen; there's no action for another instance of me to
trigger.

## State I should check first
- If the AI model isn't ready, the screen shows a setup gate, not chat.
- While a response is streaming, the send control is disabled — one turn
  at a time.

## Things I must NOT do
- Never claim to have read or acted on document content — F-14 tool
  calling (document operations from inside chat) isn't wired yet in this
  build; today's chat is conversation only.

## Cross-page handoffs
- Reached from the vault home header (Sparkles icon) once AI support
  exists on this platform.
- The setup gate links to `ai.settings` (Settings → AI Assistant) to
  download/load the model.
