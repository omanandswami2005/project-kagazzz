/**
 * Tags store (F-10). Bug-audit fix: `useTags()` used to be a plain
 * per-call-site hook with its own local `useState` — `VaultHomePage` and
 * `FavoritesPage` each got an independent snapshot, so a tag assigned from
 * one page's tag sheet never refreshed the other page's already-mounted
 * chips (this app's pages stay mounted across tab switches, same
 * `IonRouterOutlet`, so there's no natural remount to pick it up). Same
 * root cause as the historical F-10/F-84 staleness bugs already fixed for
 * the vault document list itself (`vault.store.ts`) — a shared Zustand
 * store makes every `useTags()` call site read the one true snapshot.
 */
import { create } from 'zustand';
import type { TagEntity } from '@/infrastructure/database/types';

/** Tags state shared across every `useTags()` call site. */
export interface TagsState {
  tags: TagEntity[];
  tagsByDocument: Map<string, TagEntity[]>;
  setSnapshot: (tags: TagEntity[], tagsByDocument: Map<string, TagEntity[]>) => void;
}

export const useTagsStore = create<TagsState>((set) => ({
  tags: [],
  tagsByDocument: new Map(),
  setSnapshot: (tags, tagsByDocument): void => set({ tags, tagsByDocument }),
}));
