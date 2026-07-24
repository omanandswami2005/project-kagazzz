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
import { ActionSheet, Alert, Button, Icon, Spinner } from '@kagaz/ui';
import { copyToClipboard } from '@/core/clipboard';
import { hapticAction, hapticDestructive, hapticSuccess, hapticTap } from '@/core/haptics';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { QuickNoteRow } from '../components/QuickNoteRow';
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
  // Long-press-to-select (UX pass 2026-07-24) — mirrors the vault list's
  // selectionMode/selectedIds shape (vault.store.ts), kept page-local since
  // Quick Notes has no store of its own and no other screen shares it.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const selectionMode = selectedIds.length > 0;
  const selectedEntries = entries.filter((entry) => selectedIds.includes(entry.id));

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

  const toggleSelect = (entry: QuickReferenceEntry): void => {
    hapticTap();
    setSelectedIds((ids) =>
      ids.includes(entry.id)
        ? ids.filter((id) => id !== entry.id)
        : [...ids, entry.id]
    );
  };

  const handleLongPress = (entry: QuickReferenceEntry): void => {
    hapticAction();
    setSelectedIds((ids) => (ids.includes(entry.id) ? ids : [...ids, entry.id]));
  };

  const handleBulkCopy = async (): Promise<void> => {
    const text = selectedEntries
      .map((entry) => `${entry.label}: ${entry.value}`)
      .join('\n');
    const ok = await copyToClipboard(text, { autoClearMs: CLIPBOARD_AUTO_CLEAR_MS });
    if (ok) hapticSuccess();
    setToastMsg(
      ok
        ? t('quick_notes.copied_selected', { count: selectedEntries.length })
        : t('quick_notes.copy_failed')
    );
    setSelectedIds([]);
  };

  const handleBulkDelete = async (): Promise<void> => {
    hapticDestructive();
    await Promise.all(selectedIds.map((id) => deleteEntry(id)));
    setBulkDeleteOpen(false);
    setSelectedIds([]);
  };

  return (
    <IonPage data-agent-id="vault.quick-notes">
      <IonHeader>
        <IonToolbar>
          {selectionMode ? (
            <>
              <IonButtons slot="start">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedIds([])}
                  agentId="vault.quick-notes.selection-cancel"
                >
                  <Icon name="X" size={24} aria-label={t('quick_notes.cancel_selection')} />
                </Button>
              </IonButtons>
              <IonTitle data-agent-id="vault.quick-notes.selection-count">
                {t('quick_notes.selected', { count: selectedIds.length })}
              </IonTitle>
              <IonButtons slot="end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleBulkCopy()}
                  agentId="vault.quick-notes.selection-copy"
                >
                  <Icon name="Copy" size={24} aria-label={t('quick_notes.copy_value')} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setBulkDeleteOpen(true)}
                  agentId="vault.quick-notes.selection-delete"
                >
                  <Icon name="Trash2" size={24} aria-label={t('quick_notes.delete')} />
                </Button>
              </IonButtons>
            </>
          ) : (
            <>
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
            </>
          )}
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
                <QuickNoteRow
                  key={entry.id}
                  entry={entry}
                  selectionMode={selectionMode}
                  selected={selectedIds.includes(entry.id)}
                  onCopy={(e) => void handleCopyValue(e)}
                  onToggleSelect={toggleSelect}
                  onLongPress={handleLongPress}
                  onMore={setMenuEntry}
                />
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

      {/* interaction-patterns.md §Bottom sheets vs modals: delete
         confirmation is a Modal, not a bottom sheet — also picks up
         delete_confirm_message, previously translated but never rendered
         (ActionSheet has no message slot). */}
      <Alert
        isOpen={deleteTarget !== null}
        header={t('quick_notes.delete_confirm_title')}
        message={t('quick_notes.delete_confirm_message')}
        agentId="vault.quick-notes.delete-confirm"
        onDidDismiss={() => setDeleteTarget(null)}
        buttons={[
          {
            text: t('quick_notes.delete'),
            role: 'destructive',
            handler: (): void => {
              if (deleteTarget) void handleDelete(deleteTarget);
            },
          },
          { text: t('quick_notes.cancel'), role: 'cancel' },
        ]}
      />

      <Alert
        isOpen={bulkDeleteOpen}
        header={t('quick_notes.delete_selected_title', { count: selectedIds.length })}
        message={t('quick_notes.delete_confirm_message')}
        agentId="vault.quick-notes.selection-delete-confirm"
        onDidDismiss={() => setBulkDeleteOpen(false)}
        buttons={[
          {
            text: t('quick_notes.delete'),
            role: 'destructive',
            handler: (): void => {
              void handleBulkDelete();
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
