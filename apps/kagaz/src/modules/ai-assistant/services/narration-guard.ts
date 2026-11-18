/**
 * Catches the small-model failure of announcing an action and then ending the
 * turn without calling the tool ("I will now merge the documents… please wait a
 * moment." — and silence). The chat re-prompts once so the tool actually runs.
 */
const PROMISE =
  /\b(please wait|wait a (moment|moment|sec|second)|one (moment|moment|sec|second)|just a (moment|sec|second)|hang on|bear with me|i('| a)?ll (now |just )?(merge|split|compress|resize|convert|watermark|enhance|search|read|extract|open|combine|do that|proceed|get started|start)|i will (now |just )?(merge|split|compress|resize|convert|watermark|enhance|search|read|extract|open|combine|proceed|start)|let me (merge|split|compress|resize|convert|watermark|enhance|search|read|extract|open|combine|do|get|try)|(merging|splitting|compressing|resizing|converting|processing|working on)\b.*\b(now|it|them)\b)|रुकिए|एक (पल|क्षण|मिनट)|अभी (करता|कर रहा)/i;

export const NUDGE_MESSAGE =
  'Do it now: call the tool for my request in this reply. Do not write any text before the tool call.';

/** True when a finished reply promised an action but no tool ran in the turn. */
export function shouldNudge(
  reply: string,
  toolCallsThisTurn: number,
  alreadyNudged: boolean
): boolean {
  const text = reply.trim();
  if (alreadyNudged || toolCallsThisTurn > 0 || text.length === 0 || text.length > 400) {
    return false;
  }
  if (text.endsWith('?')) {
    return false; // a real question to the user
  }
  return PROMISE.test(text);
}
