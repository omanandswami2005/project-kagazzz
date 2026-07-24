import { beforeEach, describe, expect, it } from 'vitest';
import { readPreferences, usePreferencesStore } from '../preferences.store';

beforeEach(() => {
  localStorage.clear();
  usePreferencesStore.setState({
    renameOnAdd: true,
    recentSectionCollapsed: false,
    swipeLeftAction: 'delete',
    swipeRightAction: 'favorite',
    hapticsEnabled: true,
  });
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
      swipeLeftAction: 'delete',
      swipeRightAction: 'favorite',
      hapticsEnabled: true,
    });
  });
});

describe('preferences store — swipe actions (F-88)', () => {
  it('defaults to delete on the left, favorite on the right', () => {
    expect(readPreferences().swipeLeftAction).toBe('delete');
    expect(readPreferences().swipeRightAction).toBe('favorite');
  });

  it('persists a change to either side independently', () => {
    usePreferencesStore.getState().setSwipeAction('left', 'move');
    expect(usePreferencesStore.getState().swipeLeftAction).toBe('move');
    expect(readPreferences().swipeLeftAction).toBe('move');
    expect(readPreferences().swipeRightAction).toBe('favorite');

    usePreferencesStore.getState().setSwipeAction('right', 'none');
    expect(readPreferences().swipeRightAction).toBe('none');
    expect(readPreferences().swipeLeftAction).toBe('move');
  });

  it('falls back to the default for a missing or corrupt stored value', () => {
    localStorage.setItem(
      'kagaz:preferences',
      JSON.stringify({ swipeLeftAction: 'not-a-real-action' })
    );
    expect(readPreferences().swipeLeftAction).toBe('delete');
    expect(readPreferences().swipeRightAction).toBe('favorite');
  });
});

describe('preferences store — hapticsEnabled (UX pass 2026-07-24)', () => {
  it('defaults to enabled', () => {
    expect(readPreferences().hapticsEnabled).toBe(true);
  });

  it('persists a change to localStorage', () => {
    usePreferencesStore.getState().setHapticsEnabled(false);
    expect(usePreferencesStore.getState().hapticsEnabled).toBe(false);
    expect(readPreferences().hapticsEnabled).toBe(false);
  });

  it('treats only an explicit false as disabled', () => {
    localStorage.setItem('kagaz:preferences', JSON.stringify({}));
    expect(readPreferences().hapticsEnabled).toBe(true);
  });
});
