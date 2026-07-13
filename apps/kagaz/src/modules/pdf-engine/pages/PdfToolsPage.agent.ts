/**
 * Typed page manifest for the PDF Tools hub
 * (docs/design-system/agent-interface.md §Layer 3). Opening a tool is the one
 * registry action; picking documents, setting parameters, and running are
 * direct manipulations on the screen.
 */
import { definePage } from '@kagaz/agent-kit';
import { toolsActions } from '../pdf-tools.actions';

export const PdfToolsPageAgent = definePage({
  id: 'pdf-tools',
  route: '/pdf-tools',
  intent:
    'Run on-device PDF operations: merge, split, compress, PDF↔image conversion, password protect/unlock, and fill PDF forms — saving the result to the vault.',
  surfaces: ['screen'],
  primaryAction: toolsActions.openPdfTools,
  availableActions: [toolsActions.openPdfTools],
  observableState: {},
  voiceExamples: [
    { utterance: 'merge pdfs', action: 'tools.openPdfTools', args: { op: 'merge' } },
    { utterance: 'split a pdf', action: 'tools.openPdfTools', args: { op: 'split' } },
    { utterance: 'compress a pdf', action: 'tools.openPdfTools', args: { op: 'compress' } },
    {
      utterance: 'watermark a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'watermark' },
    },
    {
      utterance: 'add page numbers',
      action: 'tools.openPdfTools',
      args: { op: 'pageNumbers' },
    },
    {
      utterance: 'edit pdf details',
      action: 'tools.openPdfTools',
      args: { op: 'metadata' },
    },
    {
      utterance: 'password protect a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'encrypt' },
    },
    { utterance: 'पीडीएफ़ मिलाओ', action: 'tools.openPdfTools', args: { op: 'merge' } },
  ],
});
