import { beforeEach, describe, expect, it } from 'vitest';
import { readPreferences, usePreferencesStore } from '../preferences.store';

beforeEach(() => {
  localStorage.clear();
  usePreferencesStore.setState({ renameOnAdd: true });
});

describe('preferences store (UX-8)', () => {
  it('defaults renameOnAdd to true', () => {
    expect(readPreferences().renameOnAdd).toBe(true);
  });

  it('persists a change to localStorage', () => {
    usePreferencesStore.getState().setRenameOnAdd(false);
    expect(usePreferencesStore.getState().renameOnAdd).toBe(false);
    expect(readPreferences().renameOnAdd).toBe(false);
  });

  it('treats only an explicit false as disabled', () => {
    localStorage.setItem('kagaz:preferences', JSON.stringify({}));
    expect(readPreferences().renameOnAdd).toBe(true);
  });
});
