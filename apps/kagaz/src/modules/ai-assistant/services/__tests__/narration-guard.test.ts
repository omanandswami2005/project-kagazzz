import { describe, expect, it } from 'vitest';
import { shouldNudge } from '../narration-guard';

describe('shouldNudge', () => {
  it('catches the reply from the phone: promise to merge, then silence', () => {
    expect(
      shouldNudge(
        'I will now merge the documents with ids doc1, doc2, doc3. Please wait a moment.',
        0,
        false
      )
    ).toBe(true);
  });

  it.each(['Let me search for that.', "I'll compress it now.", 'Merging them now…', 'एक पल रुकिए'])(
    'catches "%s"',
    (t) => {
      expect(shouldNudge(t, 0, false)).toBe(true);
    }
  );

  it('never nudges after a tool ran, after one nudge, or on a real question', () => {
    expect(shouldNudge('I will now merge them. Please wait.', 1, false)).toBe(false);
    expect(shouldNudge('I will now merge them. Please wait.', 0, true)).toBe(false);
    expect(shouldNudge('Which of the three should I merge?', 0, false)).toBe(false);
  });

  it('leaves ordinary answers and long replies alone', () => {
    expect(shouldNudge('Your rent agreement is 11 months long.', 0, false)).toBe(false);
    expect(shouldNudge('please wait '.repeat(60), 0, false)).toBe(false);
    expect(shouldNudge('', 0, false)).toBe(false);
  });
});
