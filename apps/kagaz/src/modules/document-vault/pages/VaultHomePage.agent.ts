/**
 * Typed page manifest for the vault home
 * (docs/design-system/agent-interface.md §Layer 3).
 */
import { definePage } from '@kagaz/agent-kit';
import { useVaultStore } from '../store/vault.store';
import { vaultActions } from '../vault.actions';

export const VaultHomePageAgent = definePage({
  id: 'vault.home',
  route: '/vault',
  intent:
    'Browse the documents in the vault and add new ones from the camera, gallery, or file picker.',
  surfaces: ['screen'],
  primaryAction: vaultActions.uploadDocument,
  availableActions: [
    vaultActions.uploadDocument,
    vaultActions.searchDocuments,
    vaultActions.openFilters,
    vaultActions.clearFilters,
    vaultActions.bulkDelete,
    vaultActions.bulkFavorite,
    vaultActions.createFolder,
    vaultActions.moveDocument,
    vaultActions.toggleFavorite,
    vaultActions.manageTags,
    vaultActions.tagDocument,
    vaultActions.setSortBy,
    vaultActions.toggleSortDirection,
  ],
  observableState: {
    documentCount: () => useVaultStore.getState().documents.length,
    isLoading: () => useVaultStore.getState().isLoading,
    isUploading: () => useVaultStore.getState().isUploading,
    isUploadSheetOpen: () => useVaultStore.getState().isUploadSheetOpen,
    sortBy: () => useVaultStore.getState().sortBy,
    sortDirection: () => useVaultStore.getState().sortDirection,
  },
  successPredicates: {
    'document added': (ctx) =>
      Number(ctx['documentCount']) > Number(ctx['startCount']),
    'upload finished': (ctx) => ctx['isUploading'] === false,
    'sort changed': (ctx) => ctx['sortBy'] !== ctx['startSortBy'],
  },
  voiceExamples: [
    { utterance: 'upload a document', action: 'vault.uploadDocument' },
    {
      utterance: 'take a photo of my document',
      action: 'vault.uploadDocument',
      args: { source: 'camera' },
    },
    {
      utterance: 'दस्तावेज़ अपलोड करो',
      action: 'vault.uploadDocument',
    },
    {
      utterance: 'गैलरी से फोटो जोड़ो',
      action: 'vault.uploadDocument',
      args: { source: 'gallery' },
    },
    {
      utterance: 'find my aadhaar',
      action: 'vault.searchDocuments',
      args: { query: 'aadhaar' },
    },
    { utterance: 'filter documents', action: 'vault.openFilters' },
    { utterance: 'clear filters', action: 'vault.clearFilters' },
    { utterance: 'delete selected', action: 'vault.bulkDelete' },
    { utterance: 'favorite these', action: 'vault.bulkFavorite' },
    { utterance: 'favorite this document', action: 'vault.toggleFavorite' },
    {
      utterance: 'create a folder called Taxes',
      action: 'vault.createFolder',
      args: { name: 'Taxes' },
    },
    { utterance: 'edit tags', action: 'vault.manageTags' },
    {
      utterance: 'tag this as important',
      action: 'vault.tagDocument',
      args: { tag: 'important' },
    },
    { utterance: 'sort by name', action: 'vault.setSortBy', args: { key: 'name' } },
    { utterance: 'sort by size', action: 'vault.setSortBy', args: { key: 'fileSize' } },
    { utterance: 'reverse the order', action: 'vault.toggleSortDirection' },
  ],
});
