/**
 * Typed page manifest for the document viewer (UX-6)
 * (docs/design-system/agent-interface.md §Layer 3). Read-focused: the AI can
 * read the document's extracted text aloud/summarize, but destructive actions
 * (delete) and OCR extraction are user-only (no Action Registry entries), and a
 * per-document-locked file requires the user's biometric prompt to open.
 */
import { definePage } from '@kagaz/agent-kit';

export const DocumentViewerPageAgent = definePage({
  id: 'vault.viewer',
  route: '/doc/:id',
  intent:
    'View one document — its image or PDF pages — and read or copy the text extracted from it (OCR). Deleting the document and running text extraction are user-only actions.',
  surfaces: ['screen'],
  availableActions: [],
  observableState: {},
});
