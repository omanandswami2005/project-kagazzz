import { skillCatalog } from '../skills/skill-registry';
import { SYSTEM_PROMPT } from './system-prompt';

/** The full system prompt every engine starts a chat with: identity + rules + the skill catalogue. */
export const buildSystemPrompt = (): string => `${SYSTEM_PROMPT}\n\n${skillCatalog()}`;
