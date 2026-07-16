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
    {
      utterance: 'extract pages from a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'extractPages' },
    },
    {
      utterance: 'organize pdf pages',
      action: 'tools.openPdfTools',
      args: { op: 'organize' },
    },
    { utterance: 'compress a pdf', action: 'tools.openPdfTools', args: { op: 'compress' } },
    {
      utterance: 'extract text from a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'pdfToText' },
    },
    {
      utterance: 'convert pdf to word',
      action: 'tools.openPdfTools',
      args: { op: 'pdfToWord' },
    },
    {
      utterance: 'convert pdf to excel',
      action: 'tools.openPdfTools',
      args: { op: 'pdfToExcel' },
    },
    {
      utterance: 'watermark a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'watermark' },
    },
    {
      utterance: 'add a signature to a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'stamp' },
    },
    {
      utterance: 'add page numbers',
      action: 'tools.openPdfTools',
      args: { op: 'pageNumbers' },
    },
    {
      utterance: 'add a scan to a pdf',
      action: 'tools.openPdfTools',
      args: { op: 'appendScan' },
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
