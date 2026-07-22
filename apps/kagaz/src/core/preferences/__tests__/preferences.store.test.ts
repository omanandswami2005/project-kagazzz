import { beforeEach, describe, expect, it } from 'vitest';
import { readPreferences, usePreferencesStore } from '../preferences.store';

beforeEach(() => {
  localStorage.clear();
  usePreferencesStore.setState({ renameOnAdd: true, recentSectionCollapsed: false });
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

describe('preferences store — recentSectionCollapsed (UX pass)', () => {
  it('defaults to expanded (false)', () => {
    expect(readPreferences().recentSectionCollapsed).toBe(false);
  });

  it('persists a change to localStorage', () => {
    usePreferencesStore.getState().setRecentSectionCollapsed(true);
    expect(usePreferencesStore.getState().recentSectionCollapsed).toBe(true);
    expect(readPreferences().recentSectionCollapsed).toBe(true);
  });

  it('treats only an explicit true as collapsed', () => {
    localStorage.setItem('kagaz:preferences', JSON.stringify({}));
    expect(readPreferences().recentSectionCollapsed).toBe(false);
  });

  it('setting one preference does not clobber the other', () => {
    usePreferencesStore.getState().setRecentSectionCollapsed(true);
    usePreferencesStore.getState().setRenameOnAdd(false);
    expect(readPreferences()).toEqual({
      renameOnAdd: false,
      recentSectionCollapsed: true,
    });
  });
});
