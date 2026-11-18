import { describe, expect, it } from 'vitest';
import { getChatEngine } from '../chat-engine.registry';

describe('chat engine selection', () => {
  it('V1 always uses the on-device LiteRT engine', () => {
    const engine = getChatEngine();
    expect(engine.kind).toBe('litert');
    expect(engine.locality).toBe('on-device');
  });
});
