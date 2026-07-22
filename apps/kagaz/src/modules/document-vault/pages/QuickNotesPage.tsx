/**
 * Quick Notes (UX pass, 2026-07-23, user-requested: "something same as
 * quick reference board, but less secure and fast accessibility... user
 * can store insensitive data"). The gate-free sibling of Quick Reference
 * (F-84): same label+value shape, same DAO/table (`is_secure = 0`, migration
 * 006), but **no biometric gate at all** and no mask-by-default — the whole
 * point is zero friction for things that don't need protecting. A banner
 * makes the trade-off explicit so a user doesn't put something sensitive
 * here by mistake; Quick Reference stays the answer for anything that does
 * need the lock.
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
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheet, Button, Icon, Spinner } from '@kagaz/ui';
import { copyToClipboard } from '@/core/clipboard';
import { hapticDestructive, hapticSuccess } from '@/core/haptics';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { QuickNotesEditSheet } from '../components/QuickNotesEditSheet';
import { useQuickReference } from '../hooks/useQuickReference';
import './quick-reference.css';

/** Ms after a copy before the clipboard is best-effort cleared (F-84 pattern). */
const CLIPBOARD_AUTO_CLEAR_MS = 30_000;

/** The Quick Notes screen. */
export function QuickNotesPage(): ReactNode {
  const { t } = useTranslation('documents');
  const { entries, isLoading, createEntry, updateEntry, deleteEntry } =
    useQuickReference(false);

  const [editTarget, setEditTarget] = useState<
    QuickReferenceEntry | null | undefined
  >(undefined);
  const [menuEntry, setMenuEntry] = useState<QuickReferenceEntry | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReferenceEntry | null>(
    null
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleCopyValue = async (entry: QuickReferenceEntry): Promise<void> => {
    const ok = await copyToClipboard(entry.value, {
      autoClearMs: CLIPBOARD_AUTO_CLEAR_MS,
    });
    if (ok) hapticSuccess();
    setToastMsg(t(ok ? 'quick_notes.copied' : 'quick_notes.copy_failed'));
  };

  const handleCopyWithLabel = async (
    entry: QuickReferenceEntry
  ): Promise<void> => {
    const ok = await copyToClipboard(`${entry.label}: ${entry.value}`, {
      autoClearMs: CLIPBOARD_AUTO_CLEAR_MS,
    });
    if (ok) hapticSuccess();
    setToastMsg(t(ok ? 'quick_notes.copied' : 'quick_notes.copy_failed'));
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

  return (
    <IonPage data-agent-id="vault.quick-notes">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref="/vault"
              data-agent-id="vault.quick-notes.back"
            />
          </IonButtons>
          <IonTitle>{t('quick_notes.title')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditTarget(null)}
              agentId="vault.quick-notes.add"
              agentAction="quicknotes.createEntry"
            >
              <Icon name="Plus" size={24} aria-label={t('quick_notes.add')} />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-quickref" data-agent-id="vault.quick-notes.content">
          <p
            className="kg-quickref__banner"
            role="note"
            data-agent-id="vault.quick-notes.banner"
          >
            {t('quick_notes.banner')}
          </p>

          {isLoading ? (
            <div className="kg-quickref__loading">
              <Spinner size="lg" label={t('quick_notes.title')} />
            </div>
          ) : entries.length === 0 ? (
            <div className="kg-quickref__empty" data-agent-id="vault.quick-notes.empty">
              <Icon name="StickyNote" size={48} aria-hidden />
              <p className="kg-quickref__empty-message">
                {t('quick_notes.empty_state')}
              </p>
              <p className="kg-quickref__empty-hint">
                {t('quick_notes.empty_hint')}
              </p>
              <Button
                variant="primary"
                onClick={() => setEditTarget(null)}
                agentId="vault.quick-notes.empty-add"
              >
                {t('quick_notes.add')}
              </Button>
            </div>
          ) : (
            <ul className="kg-quickref__list" data-agent-id="vault.quick-notes.list">
              {entries.map((entry) => (
                <li key={entry.id} className="kg-quickref__item">
                  <button
                    type="button"
                    className="kg-quickref__row"
                    onClick={() => setEditTarget(entry)}
                    data-agent-id={`vault.quick-notes.item-${entry.id}`}
                  >
                    <span className="kg-quickref__label">{entry.label}</span>
                    {/* No mask/reveal — Quick Notes is for data that doesn't
                        need it; shown plainly for the fastest possible read. */}
                    <span className="kg-quickref__value">{entry.value}</span>
                  </button>
                  <div className="kg-quickref__actions">
                    <button
                      type="button"
                      className="kg-quickref__action"
                      aria-label={t('quick_notes.copy_value')}
                      onClick={() => void handleCopyValue(entry)}
                      data-agent-id={`vault.quick-notes.item-${entry.id}.copy`}
                      data-agent-action="quicknotes.copyValue"
                    >
                      <Icon name="Copy" size={20} color="var(--text-muted)" />
                    </button>
                    <button
                      type="button"
                      className="kg-quickref__action"
                      aria-label={t('quick_notes.more_actions')}
                      onClick={() => setMenuEntry(entry)}
                      data-agent-id={`vault.quick-notes.item-${entry.id}.more`}
                    >
                      <Icon name="MoreVertical" size={20} color="var(--text-muted)" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>
      </IonContent>

      <QuickNotesEditSheet
        entry={editTarget}
        onClose={() => setEditTarget(undefined)}
        onSave={handleSave}
      />

      <ActionSheet
        isOpen={menuEntry !== null}
        header={menuEntry?.label}
        agentId="vault.quick-notes.item-menu"
        onDidDismiss={() => setMenuEntry(null)}
        buttons={[
          {
            text: t('quick_notes.copy_value'),
            icon: 'Copy',
            handler: (): void => {
              if (menuEntry) void handleCopyValue(menuEntry);
            },
          },
          {
            text: t('quick_notes.copy_with_label'),
            icon: 'Copy',
            handler: (): void => {
              if (menuEntry) void handleCopyWithLabel(menuEntry);
            },
          },
          {
            text: t('quick_notes.edit'),
            icon: 'Pencil',
            handler: (): void => {
              setEditTarget(menuEntry);
            },
          },
          {
            text: t('quick_notes.delete'),
            role: 'destructive',
            icon: 'Trash2',
            handler: (): void => {
              setDeleteTarget(menuEntry);
            },
          },
          { text: t('quick_notes.cancel'), role: 'cancel' },
        ]}
      />

      <ActionSheet
        isOpen={deleteTarget !== null}
        header={t('quick_notes.delete_confirm_title')}
        agentId="vault.quick-notes.delete-confirm"
        onDidDismiss={() => setDeleteTarget(null)}
        buttons={[
          {
            text: t('quick_notes.delete'),
            role: 'destructive',
            icon: 'Trash2',
            handler: (): void => {
              if (deleteTarget) void handleDelete(deleteTarget);
            },
          },
          { text: t('quick_notes.cancel'), role: 'cancel' },
        ]}
      />

      <IonToast
        isOpen={toastMsg !== null}
        message={toastMsg ?? ''}
        duration={2000}
        onDidDismiss={() => setToastMsg(null)}
        data-agent-id="vault.quick-notes.toast"
      />
    </IonPage>
  );
}

export default QuickNotesPage;
