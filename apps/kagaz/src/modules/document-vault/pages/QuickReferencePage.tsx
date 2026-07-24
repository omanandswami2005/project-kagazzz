/**
 * Quick Reference (F-84, 02-document-vault-module.md §Quick Reference).
 * A personal key-value vault: user-named label + value pairs, mask-by-
 * default, screen-level biometric gate (reuses F-16's LockScreen/
 * biometric.service). `label`/`value` are opaque user text everywhere —
 * see 10-security-architecture.md §3.6.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheet, Alert, Button, Icon, Spinner } from '@kagaz/ui';
import { copyToClipboard } from '@/core/clipboard';
import { hapticDestructive, hapticSuccess } from '@/core/haptics';
import { LockScreen } from '@/modules/auth/components/LockScreen';
import { useQuickReferenceLockStore } from '@/modules/auth/store/quick-reference-lock.store';
import { biometricAuthenticator } from '@/modules/auth/services/biometric.service';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { QuickReferenceEditSheet } from '../components/QuickReferenceEditSheet';
import { useQuickReference } from '../hooks/useQuickReference';
import './quick-reference.css';

/** Ms after a copy before the clipboard is best-effort cleared (F-84). */
const CLIPBOARD_AUTO_CLEAR_MS = 30_000;

/** Masks a value to its last 4 characters. */
function maskValue(value: string): string {
  const tail = value.slice(-4);
  return value.length <= 4 ? '••••' : `•••• ${tail}`;
}

/** The Quick Reference screen. */
export function QuickReferencePage(): ReactNode {
  const { t } = useTranslation('documents');
  const { entries, isLoading, createEntry, updateEntry, deleteEntry } =
    useQuickReference();
  const lockEnabled = useQuickReferenceLockStore((s) => s.enabled);

  const [checkingLock, setCheckingLock] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<
    QuickReferenceEntry | null | undefined
  >(undefined);
  const [menuEntry, setMenuEntry] = useState<QuickReferenceEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReferenceEntry | null>(
    null
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Screen-level biometric gate: skip when the user turned it off in Settings
  // (F-84 follow-up — off by user choice) or when unavailable (no biometry AND
  // no device credential set, same graceful-degrade posture as the rest of the
  // app) — either way, no lock screen shows.
  useEffect(() => {
    let cancelled = false;
    // Skip the native check entirely when the user turned the gate off.
    const check = lockEnabled
      ? biometricAuthenticator.isAvailable()
      : Promise.resolve(false);
    void check.then((available) => {
      if (cancelled) {
        return;
      }
      setUnlocked(!lockEnabled || !available);
      setCheckingLock(false);
    });
    return (): void => {
      cancelled = true;
    };
  }, [lockEnabled]);

  const toggleReveal = (id: string): void => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCopyValue = async (entry: QuickReferenceEntry): Promise<void> => {
    const ok = await copyToClipboard(entry.value, {
      autoClearMs: CLIPBOARD_AUTO_CLEAR_MS,
    });
    if (ok) hapticSuccess();
    setToastMsg(t(ok ? 'quick_reference.copied' : 'quick_reference.copy_failed'));
  };

  const handleCopyWithLabel = async (
    entry: QuickReferenceEntry
  ): Promise<void> => {
    const ok = await copyToClipboard(`${entry.label}: ${entry.value}`, {
      autoClearMs: CLIPBOARD_AUTO_CLEAR_MS,
    });
    if (ok) hapticSuccess();
    setToastMsg(t(ok ? 'quick_reference.copied' : 'quick_reference.copy_failed'));
  };

  const handleSave = async (
    label: string,
    value: string,
    editingId?: string
  ): Promise<void> => {
    if (editingId) {
      await updateEntry(editingId, { label, value });
    } else {
      await createEntry(label, value);
    }
    setEditTarget(undefined);
  };

  const handleDelete = async (entry: QuickReferenceEntry): Promise<void> => {
    hapticDestructive();
    await deleteEntry(entry.id);
    setDeleteTarget(null);
  };

  if (checkingLock) {
    return (
      <IonPage data-agent-id="vault.quick-reference">
        <IonContent className="kg-quickref__loading">
          <Spinner size="lg" label={t('quick_reference.title')} />
        </IonContent>
      </IonPage>
    );
  }

  if (!unlocked) {
    return (
      <IonPage data-agent-id="vault.quick-reference">
        <LockScreen
          onUnlock={async (reason) => {
            const result = await biometricAuthenticator.authenticate(reason);
            if (result === 'success') {
              setUnlocked(true);
            }
            return result;
          }}
          titleKey="lock.quick_reference_title"
          subtitleKey="lock.quick_reference_subtitle"
          reasonKey="lock.quick_reference_reason"
          agentIdPrefix="vault.quick-reference.lock"
        />
      </IonPage>
    );
  }

  return (
    <IonPage data-agent-id="vault.quick-reference">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/vault"
              data-agent-id="vault.quick-reference.back"
            />
          </IonButtons>
          <IonTitle>{t('quick_reference.title')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTarget(null)}
              agentId="vault.quick-reference.add"
              agentAction="quickref.createEntry"
            >
              <Icon name="Plus" size={24} aria-label={t('quick_reference.add')} />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-quickref" data-agent-id="vault.quick-reference.content">
          {isLoading ? (
            <div className="kg-quickref__loading">
              <Spinner size="lg" label={t('quick_reference.title')} />
            </div>
          ) : entries.length === 0 ? (
            <div className="kg-quickref__empty" data-agent-id="vault.quick-reference.empty">
              <Icon name="Copy" size={48} aria-hidden />
              <p className="kg-quickref__empty-message">
                {t('quick_reference.empty_state')}
              </p>
              <p className="kg-quickref__empty-hint">
                {t('quick_reference.empty_hint')}
              </p>
              <Button
                variant="primary"
                onClick={() => setEditTarget(null)}
                agentId="vault.quick-reference.empty-add"
              >
                {t('quick_reference.add')}
              </Button>
            </div>
          ) : (
            <ul className="kg-quickref__list" data-agent-id="vault.quick-reference.list">
              {entries.map((entry) => {
                const revealed = revealedIds.has(entry.id);
                return (
                  <li key={entry.id} className="kg-quickref__item">
                    <button
                      type="button"
                      className="kg-quickref__row"
                      onClick={() => toggleReveal(entry.id)}
                      aria-label={revealed ? t('quick_reference.hide') : t('quick_reference.reveal')}
                      aria-pressed={revealed}
                      data-agent-id={`vault.quick-reference.item-${entry.id}`}
                      data-agent-state={revealed ? 'expanded' : 'collapsed'}
                    >
                      <span className="kg-quickref__label">{entry.label}</span>
                      <span className="kg-quickref__value">
                        {revealed ? entry.value : maskValue(entry.value)}
                      </span>
                    </button>
                    <div className="kg-quickref__actions">
                      <button
                        type="button"
                        className="kg-quickref__action"
                        aria-label={t('quick_reference.copy_value')}
                        onClick={() => void handleCopyValue(entry)}
                        data-agent-id={`vault.quick-reference.item-${entry.id}.copy`}
                        data-agent-action="quickref.copyValue"
                      >
                        <Icon name="Copy" size={20} color="var(--text-muted)" />
                      </button>
                      <button
                        type="button"
                        className="kg-quickref__action"
                        aria-label={t('quick_reference.more_actions')}
                        onClick={() => setMenuEntry(entry)}
                        data-agent-id={`vault.quick-reference.item-${entry.id}.more`}
                      >
                        <Icon name="MoreVertical" size={20} color="var(--text-muted)" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </IonContent>

      <QuickReferenceEditSheet
        entry={editTarget}
        onClose={() => setEditTarget(undefined)}
        onSave={handleSave}
      />

      <ActionSheet
        isOpen={menuEntry !== null}
        header={menuEntry?.label}
        agentId="vault.quick-reference.item-menu"
        onDidDismiss={() => setMenuEntry(null)}
        buttons={[
          {
            text: t('quick_reference.copy_value'),
            icon: 'Copy',
            handler: (): void => {
              if (menuEntry) void handleCopyValue(menuEntry);
            },
          },
          {
            text: t('quick_reference.copy_with_label'),
            icon: 'Copy',
            handler: (): void => {
              if (menuEntry) void handleCopyWithLabel(menuEntry);
            },
          },
          {
            text: t('quick_reference.edit'),
            icon: 'Pencil',
            handler: (): void => {
              setEditTarget(menuEntry);
            },
          },
          {
            text: t('quick_reference.delete'),
            role: 'destructive',
            icon: 'Trash2',
            handler: (): void => {
              setDeleteTarget(menuEntry);
            },
          },
          { text: t('quick_reference.cancel'), role: 'cancel' },
        ]}
      />

      {/* interaction-patterns.md §Bottom sheets vs modals: delete
         confirmation is a Modal, not a bottom sheet — also picks up
         delete_confirm_message, previously translated but never rendered
         (ActionSheet has no message slot). */}
      <Alert
        isOpen={deleteTarget !== null}
        header={t('quick_reference.delete_confirm_title')}
        message={t('quick_reference.delete_confirm_message')}
        agentId="vault.quick-reference.delete-confirm"
        onDidDismiss={() => setDeleteTarget(null)}
        buttons={[
          {
            text: t('quick_reference.delete'),
            role: 'destructive',
            handler: (): void => {
              if (deleteTarget) void handleDelete(deleteTarget);
            },
          },
          { text: t('quick_reference.cancel'), role: 'cancel' },
        ]}
      />

      <IonToast
        isOpen={toastMsg !== null}
        message={toastMsg ?? ''}
        duration={2000}
        onDidDismiss={() => setToastMsg(null)}
        data-agent-id="vault.quick-reference.toast"
      />
    </IonPage>
  );
}

export default QuickReferencePage;
