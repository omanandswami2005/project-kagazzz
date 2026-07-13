/**
 * The per-operation flow for the PDF Tools hub: pick the input document(s),
 * set any operation-specific parameters, then run the engine and save the
 * result to the vault. One adaptive modal covers all eight operations.
 */
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Icon, Input, ProgressBar } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type {
  CompressionLevel,
  FormField,
  PageNumberFormat,
  PageNumberPosition,
  PdfMetadata,
} from '../types/pdf-engine.types';
import type { UsePdfEngineResult } from '../hooks/usePdfEngine';
import { IMAGE_TYPES, PDF_OPS, type PdfOpId } from '../services/pdf-ops-meta';
import { parsePageRanges } from '../services/parse-ranges';
import { pdfErrorMessageKey } from '../services/pdf-error-message';
import { PdfDocPicker } from './PdfDocPicker';

/** Props for {@link PdfOpSheet}. */
export interface PdfOpSheetProps {
  /** The active operation, or null when the sheet is closed. */
  op: PdfOpId | null;
  documents: DocumentEntity[];
  engine: UsePdfEngineResult;
  onClose: () => void;
  /** Called with the number of files saved once the op succeeds. */
  onDone: (savedCount: number) => void;
}

const QUALITIES: CompressionLevel[] = ['low', 'medium', 'high'];
const PAGE_NUMBER_POSITIONS: PageNumberPosition[] = [
  'bottom-center',
  'bottom-right',
  'bottom-left',
  'top-center',
  'top-right',
  'top-left',
];
const PAGE_NUMBER_FORMATS: PageNumberFormat[] = ['plain', 'page-n', 'n-of-total'];

/** Adaptive operation modal. */
export function PdfOpSheet({
  op,
  documents,
  engine,
  onClose,
  onDone,
}: PdfOpSheetProps): ReactNode {
  const { t } = useTranslation('tools');
  const meta = op ? PDF_OPS.find((o) => o.id === op) : null;

  const docs = useMemo(() => {
    if (!meta) {
      return [];
    }
    if (meta.input === 'images') {
      return documents.filter((d) => IMAGE_TYPES.has(d.fileType.toLowerCase()));
    }
    return documents.filter((d) => d.fileType.toLowerCase() === 'pdf');
  }, [meta, documents]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ranges, setRanges] = useState('');
  const [quality, setQuality] = useState<CompressionLevel>('medium');
  const [format, setFormat] = useState<'png' | 'jpeg'>('png');
  const [password, setPassword] = useState('');
  const [watermarkText, setWatermarkText] = useState('');
  const [pageNumberPosition, setPageNumberPosition] =
    useState<PageNumberPosition>('bottom-center');
  const [pageNumberFormat, setPageNumberFormat] = useState<PageNumberFormat>('plain');
  const [fields, setFields] = useState<FormField[] | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  // F-39: null while the selected PDF's metadata loads, then the editable draft.
  const [metaDraft, setMetaDraft] = useState<PdfMetadata | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Reset all parameters when the operation changes. (A `key` remount would
  // reset state too, but on this IonModal it would skip the close animation.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSelectedIds([]);
    setRanges('');
    setQuality('medium');
    setFormat('png');
    setPassword('');
    setWatermarkText('');
    setPageNumberPosition('bottom-center');
    setPageNumberFormat('plain');
    setFields(null);
    setFieldValues({});
    setMetaDraft(null);
    setLocalError(null);
    engine.reset();
    // engine identity is stable; resetting on op change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const multi = meta?.input === 'pdf-multi' || meta?.input === 'images';
  const selectedDocs = docs.filter((d) => selectedIds.includes(d.id));

  // For Fill form: read the selected PDF's fields. (op-change resets `fields`.)
  useEffect(() => {
    if (op !== 'fillForm' || selectedIds.length !== 1) {
      return undefined;
    }
    const doc = docs.find((d) => d.id === selectedIds[0]);
    if (!doc) {
      return undefined;
    }
    let cancelled = false;
    // Show the loading state, then fetch this PDF's fields (data-load effect).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(null);
    engine
      .loadFormFields(doc)
      .then((f) => {
        if (!cancelled) {
          setFields(f);
          setFieldValues(Object.fromEntries(f.map((x) => [x.name, x.value])));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFields([]);
        }
      });
    return (): void => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op, selectedIds]);

  // For Edit metadata: read the selected PDF's metadata into an editable draft.
  useEffect(() => {
    if (op !== 'metadata' || selectedIds.length !== 1) {
      return undefined;
    }
    const doc = docs.find((d) => d.id === selectedIds[0]);
    if (!doc) {
      return undefined;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMetaDraft(null);
    engine
      .loadMetadata(doc)
      .then((m) => {
        if (!cancelled) {
          setMetaDraft(m);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMetaDraft({ title: '', author: '', subject: '', keywords: '' });
        }
      });
    return (): void => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [op, selectedIds]);

  const handleRun = (): void => {
    setLocalError(null);
    if (!op) {
      return;
    }
    void dispatchRun().then((count) => {
      if (count > 0) {
        onDone(count);
      }
    });
  };

  /** Validates inputs and runs the engine; resolves the saved count. */
  const dispatchRun = async (): Promise<number> => {
    switch (op) {
      case 'merge':
        if (selectedDocs.length < 2) {
          setLocalError(t('errors.need_two'));
          return 0;
        }
        return engine.mergePdfs(selectedDocs);
      case 'imagesToPdf':
        if (selectedDocs.length < 1) {
          setLocalError(t('errors.need_one'));
          return 0;
        }
        return engine.imagesToPdf(selectedDocs);
      default: {
        const doc = selectedDocs[0];
        if (!doc) {
          setLocalError(t('errors.need_one'));
          return 0;
        }
        if (op === 'split') {
          const parsed = parsePageRanges(ranges);
          if (!parsed) {
            setLocalError(t('errors.bad_ranges'));
            return 0;
          }
          return engine.splitPdf(doc, parsed);
        }
        if (op === 'compress') {
          return engine.compressPdf(doc, quality);
        }
        if (op === 'watermark') {
          if (!watermarkText.trim()) {
            setLocalError(t('errors.need_watermark'));
            return 0;
          }
          return engine.watermarkPdf(doc, watermarkText);
        }
        if (op === 'pageNumbers') {
          return engine.addPageNumbers(doc, {
            position: pageNumberPosition,
            format: pageNumberFormat,
          });
        }
        if (op === 'pdfToImages') {
          return engine.pdfToImages(doc, { format });
        }
        if (op === 'encrypt' || op === 'decrypt') {
          if (!password) {
            setLocalError(t('errors.need_password'));
            return 0;
          }
          return op === 'encrypt'
            ? engine.encryptPdf(doc, password)
            : engine.decryptPdf(doc, password);
        }
        if (op === 'fillForm') {
          return engine.fillForm(doc, fieldValues);
        }
        if (op === 'metadata') {
          if (!metaDraft) {
            return 0;
          }
          return engine.setMetadata(doc, metaDraft);
        }
        return 0;
      }
    }
  };

  const busy = engine.state.busy;
  // Show a specific, actionable message (e.g. wrong password) mapped from the
  // engine's error code, falling back to the generic failure text.
  const engineErrorKey = pdfErrorMessageKey(engine.state.errorCode);
  const error = localError ?? (engineErrorKey ? t(engineErrorKey) : null);

  return (
    <IonModal
      isOpen={op !== null}
      onDidDismiss={onClose}
      data-agent-id="pdf-tools.op-sheet"
      data-agent-state={op ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{op ? t(`ops.${op}`) : ''}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="pdf-tools.op-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-pdf-op">
          <PdfDocPicker
            documents={docs}
            multi={multi}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            emptyText={
              meta?.input === 'images' ? t('pick.empty_images') : t('pick.empty_pdf')
            }
          />

          {selectedDocs.length > 0 && renderParams()}

          {error && (
            <p
              className="kg-pdf-op__error"
              role="alert"
              data-agent-id="pdf-tools.op-sheet.error"
              data-agent-state="error"
            >
              {error}
            </p>
          )}

          {busy && (
            <div className="kg-pdf-op__progress" data-agent-state="loading">
              <ProgressBar
                value={engine.state.percent}
                aria-label={t('running')}
                showLabel
                indeterminate={engine.state.saving}
              />
              <p className="kg-pdf-op__status">
                {engine.state.saving
                  ? t('finalizing')
                  : engine.state.message || t('running')}
              </p>
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div className="kg-pdf-op__footer">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || selectedDocs.length === 0}
            onClick={handleRun}
            agentId="pdf-tools.op-sheet.run"
          >
            {busy ? t('running') : t('run')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );

  /** Operation-specific parameter inputs. */
  function renderParams(): ReactNode {
    if (op === 'split') {
      return (
        <Input
          label={t('params.ranges')}
          placeholder="1-3, 5, 8-10"
          helperText={t('params.ranges_hint')}
          value={ranges}
          onChange={setRanges}
          agentId="pdf-tools.op-sheet.ranges"
        />
      );
    }
    if (op === 'compress') {
      return (
        <div className="kg-pdf-op__choices" role="group" aria-label={t('params.quality')}>
          <p className="kg-pdf-op__label">{t('params.quality')}</p>
          {QUALITIES.map((q) => (
            <Button
              key={q}
              variant={quality === q ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setQuality(q)}
              agentId={`pdf-tools.op-sheet.quality-${q}`}
            >
              {t(`params.quality_${q}`)}
            </Button>
          ))}
        </div>
      );
    }
    if (op === 'pdfToImages') {
      return (
        <div className="kg-pdf-op__choices" role="group" aria-label={t('params.format')}>
          <p className="kg-pdf-op__label">{t('params.format')}</p>
          {(['png', 'jpeg'] as const).map((f) => (
            <Button
              key={f}
              variant={format === f ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setFormat(f)}
              agentId={`pdf-tools.op-sheet.format-${f}`}
            >
              {f.toUpperCase()}
            </Button>
          ))}
        </div>
      );
    }
    if (op === 'watermark') {
      return (
        <Input
          label={t('params.watermark_text')}
          placeholder={t('params.watermark_placeholder')}
          helperText={t('params.watermark_hint')}
          value={watermarkText}
          onChange={setWatermarkText}
          agentId="pdf-tools.op-sheet.watermark-text"
        />
      );
    }
    if (op === 'pageNumbers') {
      return (
        <>
          <div
            className="kg-pdf-op__choices"
            role="group"
            aria-label={t('params.number_position')}
          >
            <p className="kg-pdf-op__label">{t('params.number_position')}</p>
            {PAGE_NUMBER_POSITIONS.map((p) => (
              <Button
                key={p}
                variant={pageNumberPosition === p ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPageNumberPosition(p)}
                agentId={`pdf-tools.op-sheet.number-position-${p}`}
              >
                {t(`params.position_${p}`)}
              </Button>
            ))}
          </div>
          <div
            className="kg-pdf-op__choices"
            role="group"
            aria-label={t('params.number_format')}
          >
            <p className="kg-pdf-op__label">{t('params.number_format')}</p>
            {PAGE_NUMBER_FORMATS.map((f) => (
              <Button
                key={f}
                variant={pageNumberFormat === f ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setPageNumberFormat(f)}
                agentId={`pdf-tools.op-sheet.number-format-${f}`}
              >
                {t(`params.number_format_${f}`)}
              </Button>
            ))}
          </div>
        </>
      );
    }
    if (op === 'encrypt' || op === 'decrypt') {
      return (
        <Input
          type="password"
          label={t('params.password')}
          helperText={op === 'encrypt' ? t('params.password_hint') : undefined}
          value={password}
          onChange={setPassword}
          agentId="pdf-tools.op-sheet.password"
        />
      );
    }
    if (op === 'metadata') {
      if (metaDraft === null) {
        return <p className="kg-pdf-op__status">{t('params.metadata_loading')}</p>;
      }
      const METADATA_FIELDS: { key: keyof PdfMetadata }[] = [
        { key: 'title' },
        { key: 'author' },
        { key: 'subject' },
        { key: 'keywords' },
      ];
      return (
        <div className="kg-pdf-op__fields">
          {METADATA_FIELDS.map(({ key }) => (
            <Input
              key={key}
              label={t(`params.metadata_${key}`)}
              helperText={key === 'keywords' ? t('params.metadata_keywords_hint') : undefined}
              value={metaDraft[key]}
              onChange={(value) =>
                setMetaDraft((m) => (m ? { ...m, [key]: value } : m))
              }
              agentId={`pdf-tools.op-sheet.metadata-${key}`}
            />
          ))}
        </div>
      );
    }
    if (op === 'fillForm') {
      if (fields === null) {
        return <p className="kg-pdf-op__status">{t('params.fields_loading')}</p>;
      }
      if (fields.length === 0) {
        return <p className="kg-pdf-op__status">{t('params.fields_none')}</p>;
      }
      return (
        <div className="kg-pdf-op__fields">
          {fields.map((field) =>
            field.type === 'checkbox' ? (
              <Checkbox
                key={field.name}
                label={field.name}
                checked={fieldValues[field.name] === 'true'}
                onChange={(checked) =>
                  setFieldValues((v) => ({ ...v, [field.name]: String(checked) }))
                }
                agentId={`pdf-tools.op-sheet.field-${field.name}`}
              />
            ) : (
              <Input
                key={field.name}
                label={field.name}
                value={fieldValues[field.name] ?? ''}
                onChange={(value) =>
                  setFieldValues((v) => ({ ...v, [field.name]: value }))
                }
                agentId={`pdf-tools.op-sheet.field-${field.name}`}
              />
            )
          )}
        </div>
      );
    }
    return null;
  }
}
