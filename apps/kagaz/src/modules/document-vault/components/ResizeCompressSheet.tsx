/**
 * Resize & Compress for Forms (F-85, 02-document-vault-module.md
 * §Resize & Compress for Forms). Picks exact target dimensions (with an
 * aspect-ratio-lock convenience that keeps width/height proportional to the
 * source image while editing) and a target size range, then runs
 * `useResizeCompress` and saves the result as a new document.
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
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Checkbox, Icon, Input, ProgressBar } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useImageDimensions } from '../hooks/useImageDimensions';
import {
  useResizeCompress,
  type ResizeCompressOutcome,
} from '../hooks/useResizeCompress';
import './resize-compress-sheet.css';

/** A tappable dimension preset (common Indian government-form specs). */
interface DimensionPreset {
  key: 'passport' | 'pan' | 'signature';
  width: number;
  height: number;
}

const PRESETS: DimensionPreset[] = [
  { key: 'passport', width: 200, height: 230 },
  { key: 'pan', width: 213, height: 213 },
  { key: 'signature', width: 140, height: 60 },
];

/** Props for {@link ResizeCompressSheet}. */
export interface ResizeCompressSheetProps {
  /** The document to resize, or null when the sheet is closed. */
  document: DocumentEntity | null;
  onClose: () => void;
  /** Called once a run finishes (success or failure) so the caller can toast. */
  onDone?: (outcome: ResizeCompressOutcome) => void;
}

/** Parses a form field to a positive integer, or null if invalid. */
function positiveInt(value: string): number | null {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** The Resize & compress form sheet. */
export function ResizeCompressSheet({
  document,
  onClose,
  onDone,
}: ResizeCompressSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const { runningId, run } = useResizeCompress();
  const sourceDimensions = useImageDimensions(document);

  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockAspectRatio, setLockAspectRatio] = useState(false);
  const [maxSizeKb, setMaxSizeKb] = useState('');
  const [minSizeKb, setMinSizeKb] = useState('');
  const [outcome, setOutcome] = useState<ResizeCompressOutcome | null>(null);

  // Reset the form each time a new document is opened into the sheet. (A
  // `key` remount would reset state too, but on this IonModal it would skip
  // the close animation — same trade-off PdfOpSheet makes for the same reason.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setWidth('');
    setHeight('');
    setLockAspectRatio(false);
    setMaxSizeKb('');
    setMinSizeKb('');
    setOutcome(null);
  }, [document?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const applyPreset = (preset: DimensionPreset): void => {
    setWidth(String(preset.width));
    setHeight(String(preset.height));
    setLockAspectRatio(false);
  };

  const handleWidthChange = (value: string): void => {
    setWidth(value);
    if (lockAspectRatio && sourceDimensions) {
      const w = positiveInt(value);
      if (w) {
        setHeight(
          String(Math.round((w * sourceDimensions.height) / sourceDimensions.width))
        );
      }
    }
  };

  const handleHeightChange = (value: string): void => {
    setHeight(value);
    if (lockAspectRatio && sourceDimensions) {
      const h = positiveInt(value);
      if (h) {
        setWidth(
          String(Math.round((h * sourceDimensions.width) / sourceDimensions.height))
        );
      }
    }
  };

  const widthN = positiveInt(width);
  const heightN = positiveInt(height);
  const maxSizeN = positiveInt(maxSizeKb);
  const minSizeN = positiveInt(minSizeKb);
  const canRun = !!widthN && !!heightN && !!maxSizeN;
  const busy = document !== null && runningId === document.id;

  const handleRun = (): void => {
    if (!document || !widthN || !heightN || !maxSizeN) {
      return;
    }
    void run(document, {
      width: widthN,
      height: heightN,
      maxSizeBytes: maxSizeN * 1024,
      minSizeBytes: minSizeN ? minSizeN * 1024 : undefined,
    }).then((result) => {
      setOutcome(result);
      onDone?.(result);
    });
  };

  return (
    <IonModal
      isOpen={document !== null}
      onDidDismiss={onClose}
      data-agent-id="vault.home.resize-compress-sheet"
      data-agent-state={document ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('resize_compress.title')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="vault.home.resize-compress-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-resize-compress">
          <p className="kg-resize-compress__label">
            {t('resize_compress.title')}
          </p>
          <div
            className="kg-resize-compress__presets"
            role="group"
            aria-label={t('resize_compress.title')}
          >
            {PRESETS.map((preset) => (
              <Button
                key={preset.key}
                variant="secondary"
                size="sm"
                onClick={() => applyPreset(preset)}
                agentId={`vault.home.resize-compress-preset-${preset.key}`}
              >
                {t(`resize_compress.preset_${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="kg-resize-compress__fields">
            <Input
              type="number"
              label={t('resize_compress.width')}
              value={width}
              onChange={handleWidthChange}
              agentId="vault.home.resize-compress-width"
            />
            <Input
              type="number"
              label={t('resize_compress.height')}
              value={height}
              onChange={handleHeightChange}
              agentId="vault.home.resize-compress-height"
            />
            <Checkbox
              label={t('resize_compress.lock_aspect_ratio')}
              checked={lockAspectRatio}
              disabled={!sourceDimensions}
              onChange={setLockAspectRatio}
              agentId="vault.home.resize-compress-lock-aspect"
            />
            <Input
              type="number"
              label={t('resize_compress.max_size_kb')}
              value={maxSizeKb}
              onChange={setMaxSizeKb}
              agentId="vault.home.resize-compress-max-size"
            />
            <Input
              type="number"
              label={t('resize_compress.min_size_kb')}
              value={minSizeKb}
              onChange={setMinSizeKb}
              agentId="vault.home.resize-compress-min-size"
            />
          </div>

          {busy && (
            <div className="kg-resize-compress__progress" data-agent-state="loading">
              <ProgressBar
                value={0}
                aria-label={t('resize_compress.running')}
                indeterminate
              />
              <p className="kg-resize-compress__status">
                {t('resize_compress.running')}
              </p>
            </div>
          )}

          {!busy && outcome && (
            <p
              className="kg-resize-compress__status"
              role="status"
              data-agent-id="vault.home.resize-compress-result"
              data-agent-state={outcome.saved ? 'success' : 'error'}
            >
              {!outcome.saved
                ? t('resize_compress.failed')
                : outcome.hitQualityFloor
                  ? t('resize_compress.quality_floor_warning')
                  : outcome.belowMinSize
                    ? t('resize_compress.below_min_warning')
                    : t('resize_compress.done')}
            </p>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div className="kg-resize-compress__footer">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || !canRun}
            onClick={handleRun}
            agentId="vault.home.resize-compress-run"
            agentAction="vault.resizeCompress"
          >
            {busy ? t('resize_compress.running') : t('resize_compress.run')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
