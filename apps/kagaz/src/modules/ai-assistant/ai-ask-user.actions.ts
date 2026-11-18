/**
 * `ai.askUser` — how the model asks the person for something it cannot look
 * up (sizes, quality, text to stamp, a date, which document) without a wall of
 * typed questions. The form appears in the chat; the tool returns at once and
 * the model's turn ENDS — the answer arrives as the user's next message. That
 * makes it work identically on every engine (no pending call to time out — the
 * native bridge drops a pending call after 30 s) and survive closing the app.
 */
import { defineAction } from '@kagaz/agent-kit';
import type { AiToolContext } from './ai-tools.actions';
import { askUserSchema, type AskUserSpec } from './types/ask-user';

/** Tool ids whose result ends the model's turn (read by the engines). */
export const END_TURN_TOOLS = ['ai.askUser'];

export const aiAskUserActions = {
  askUser: defineAction({
    id: 'ai.askUser',
    summary:
      'ALWAYS use this — never plain text — whenever you must ask the user for something to finish a task: a form (1-3 fields: choice, multi, number, text, toggle, date, document) appears in the chat. Examples: photo size missing → ai.askUser({question:"What size should the photo be?", fields:[{id:"width",label:"Width",type:"number",unit:"px"},{id:"height",label:"Height",type:"number",unit:"px"},{id:"maxSizeKb",label:"Max file size",type:"number",unit:"KB"}]}); watermark text missing → ai.askUser({question:"What should the watermark say?", fields:[{id:"text",label:"Watermark text",type:"text"}]}). After calling it, STOP: write nothing more; their answer arrives as their next message. Never ask for passwords, OTPs or ID numbers.',
    args: askUserSchema,
    requiresConfirmation: false,
    handler: (args: AskUserSpec, ctx: AiToolContext): Promise<{ status: 'waiting_for_user' }> =>
      Promise.resolve().then(() => ctx.askUser(args)),
  }),
};
