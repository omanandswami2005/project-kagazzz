/**
 * Settings screen (02-document-vault-module.md §Settings). V1 scope so far:
 * Appearance → Theme (F-18, system/light/dark; persisted by ThemeProvider).
 * Language (F-17), Security/biometric (F-16), density, and About land with
 * their own items — each slots in as another `<section>` here.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { Fragment, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  Icon,
  ListRow,
  SegmentedControl,
  Toggle,
  type IconName,
} from '@kagaz/ui';
import { DeleteAllDataDialog } from '../components/DeleteAllDataDialog';
import { useBackupExport } from '../hooks/useBackupExport';
import { useBackupRestore } from '../hooks/useBackupRestore';
import { useLocale, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/core/i18n';
import type { SwipeActionKind } from '@/core/gestures';
import { useLockSettings } from '@/modules/auth/hooks/useLockSettings';
import { useQuickReferenceLockSettings } from '@/modules/auth/hooks/useQuickReferenceLockSettings';
import { AUTO_LOCK_TIMEOUTS } from '@/modules/auth/store/lock.store';
import { useTheme, type ThemeSetting } from '@/app/providers/ThemeProvider';
import { useAi } from '@/app/providers/AIProvider';
import { usePreferencesStore } from '@/core/preferences';
import { APP_VERSION } from '@/core/logging';
import { WELCOME_TOUR_TIP } from '@/app/onboarding/tour';
import './settings.css';

const THEME_OPTIONS: readonly ThemeSetting[] = ['system', 'light', 'dark'];
/** Native names shown in each language's own script (settings namespace keys). */
const LANGUAGE_LABEL = {
  en: 'english',
  hi: 'hindi',
} as const satisfies Record<SupportedLanguage, string>;
/** F-88: every choice offered for swipe-left / swipe-right, in display order. */
const SWIPE_ACTION_OPTIONS: readonly SwipeActionKind[] = [
  'delete',
  'favorite',
  'move',
  'tags',
  'archive',
  'none',
];

/** About-section destinations: route slug, label key, leading icon. */
const ABOUT_LINKS = [
  ['privacy', 'about.privacy_policy', 'ShieldCheck'],
  ['terms', 'about.terms', 'FileText'],
  ['licenses', 'about.licenses', 'Info'],
] as const satisfies readonly (readonly [string, string, IconName])[];

/** A titled settings group rendered as a card (audit SE-5, SE-9). */
function SettingsSection({
  id,
  icon,
  title,
  danger = false,
  children,
}: {
  id: string;
  icon: IconName;
  title: string;
  danger?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <section
      className={`kg-settings__section${danger ? ' kg-settings__section--danger' : ''}`}
      aria-labelledby={id}
    >
      <h2 className="kg-settings__section-title" id={id}>
        <Icon name={icon} size={16} />
        {title}
      </h2>
      <div className="kg-settings__card">{children}</div>
    </section>
  );
}

/** The app Settings page. */
export function SettingsPage(): ReactNode {
  const { t, i18n } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const { locale, formatDateTime } = useLocale();
  const lock = useLockSettings();
  const aiSupported = useAi().status !== 'unsupported';
  const quickRefLock = useQuickReferenceLockSettings();
  const backup = useBackupExport();
  const restore = useBackupRestore();
  const router = useIonRouter();
  const [eraseOpen, setEraseOpen] = useState(false);
  const renameOnAdd = usePreferencesStore((s) => s.renameOnAdd);
  const setRenameOnAdd = usePreferencesStore((s) => s.setRenameOnAdd);
  const swipeLeftAction = usePreferencesStore((s) => s.swipeLeftAction);
  const swipeRightAction = usePreferencesStore((s) => s.swipeRightAction);
  const setSwipeAction = usePreferencesStore((s) => s.setSwipeAction);
  const hapticsEnabled = usePreferencesStore((s) => s.hapticsEnabled);
  const lastBackupAt = usePreferencesStore((s) => s.lastBackupAt);
  const forgetTip = usePreferencesStore((s) => s.forgetTip);
  const setHapticsEnabled = usePreferencesStore((s) => s.setHapticsEnabled);

  return (
    <IonPage data-agent-id="settings">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" data-agent-id="settings.back" />
          </IonButtons>
          <IonTitle>{t('title')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-settings" data-agent-id="settings.content">
          {/* SE-6 (NBA): until a backup exists, the one action that protects
             everything sits at the top. */}
          {lastBackupAt === null && (
            <section className="kg-settings__nudge" data-agent-id="settings.backup-nudge">
              <Icon name="DatabaseBackup" size={32} />
              <div className="kg-settings__nudge-text">
                <p className="kg-settings__nudge-title">{t('backup_nudge.title')}</p>
                <p className="kg-settings__hint">{t('backup_nudge.body')}</p>
              </div>
              <Button
                size="sm"
                onClick={() => void backup.exportBackup()}
                loading={backup.status === 'running'}
                agentId="settings.backup-nudge.backup"
              >
                {t('backup_nudge.action')}
              </Button>
            </section>
          )}

          <SettingsSection id="settings-language" icon="Languages" title={t('language.title')}>
            <SegmentedControl
              aria-labelledby="settings-language"
              agentId="settings.language"
              agentAction="settings.setLanguage"
              value={locale as SupportedLanguage}
              onChange={(lng) => void i18n.changeLanguage(lng)}
              options={SUPPORTED_LANGUAGES.map((lng) => ({
                value: lng,
                label: t(`language.${LANGUAGE_LABEL[lng]}`),
              }))}
              fullWidth
            />
          </SettingsSection>

          <SettingsSection id="settings-appearance" icon="Palette" title={t('appearance.title')}>
            <span className="kg-settings__label" id="settings-theme-label">
              {t('appearance.theme')}
            </span>
            <SegmentedControl
              aria-labelledby="settings-theme-label"
              agentId="settings.theme"
              agentAction="settings.setTheme"
              value={theme}
              onChange={setTheme}
              options={THEME_OPTIONS.map((option) => ({
                value: option,
                label: t(`appearance.theme_${option}`),
              }))}
              fullWidth
            />
          </SettingsSection>

          <SettingsSection id="settings-documents" icon="FileText" title={t('documents.title')}>
            <Toggle
              enabled={renameOnAdd}
              label={t('documents.rename_on_add')}
              onChange={setRenameOnAdd}
              agentId="settings.rename-on-add"
            />
            <p className="kg-settings__hint">{t('documents.rename_on_add_hint')}</p>
          </SettingsSection>

          <SettingsSection id="settings-security" icon="ShieldCheck" title={t('security.title')}>
            <Toggle
              enabled={lock.enabled}
              disabled={lock.available === false || lock.busy}
              label={t('security.biometric_lock')}
              onChange={lock.toggle}
              agentId="settings.biometric-lock"
            />
            <p className="kg-settings__hint">
              {lock.available === false
                ? t('security.biometric_unavailable')
                : t('security.biometric_lock_hint')}
            </p>
            {lock.enabled && (
              <>
                <span className="kg-settings__label" id="settings-autolock">
                  {t('security.auto_lock')}
                </span>
                <SegmentedControl
                  aria-labelledby="settings-autolock"
                  agentId="settings.auto-lock"
                  value={lock.timeout}
                  onChange={lock.setAutoLock}
                  options={AUTO_LOCK_TIMEOUTS.map((option) => ({
                    value: option,
                    label: t(`security.auto_lock_${option}`),
                  }))}
                />
              </>
            )}
            <div className="kg-settings__divider" />
            <Toggle
              enabled={quickRefLock.enabled}
              label={t('security.quickref_lock')}
              onChange={quickRefLock.setEnabled}
              agentId="settings.quickref-lock"
            />
            <p className="kg-settings__hint">{t('security.quickref_lock_hint')}</p>
          </SettingsSection>

          <SettingsSection id="settings-data" icon="DatabaseBackup" title={t('data.title')}>
            <ListRow
              icon="Download"
              title={t('data.backup')}
              onClick={() => void backup.exportBackup()}
              loading={backup.status === 'running'}
              agentId="settings.export-backup"
              hint={
                <span data-agent-id="settings.backup-status" data-agent-state={backup.status}>
                  {backup.status === 'done' && backup.result
                    ? t('data.backup_done', { count: backup.result.documentCount })
                    : backup.status === 'error'
                      ? t('data.backup_error')
                      : lastBackupAt
                        ? t('data.backup_last', { date: formatDateTime(lastBackupAt) })
                        : t('data.backup_hint')}
                </span>
              }
            />
            <ListRow
              icon="Upload"
              title={t('data.restore')}
              onClick={() => void restore.pickBackup()}
              loading={restore.status === 'reading'}
              agentId="settings.restore-backup"
              hint={
                <span data-agent-id="settings.restore-status" data-agent-state={restore.status}>
                  {restore.status === 'reading'
                    ? t('data.restore_reading')
                    : restore.status === 'done' && restore.result
                      ? t('data.restore_done', { count: restore.result.restoredDocuments })
                      : restore.status === 'error'
                        ? t('data.restore_error')
                        : t('data.restore_hint')}
                </span>
              }
            />
            {/* On-device AI is Android-only in V1 (AI-X4): no dead entry point on iOS/web. */}
            {aiSupported && (
              <ListRow
                icon="Cpu"
                title={t('ai.manage')}
                hint={t('ai.manage_hint')}
                onClick={() => router.push('/ai-assistant')}
                agentId="settings.open-ai-assistant"
              />
            )}
          </SettingsSection>

          {/* SE-7 (progressive disclosure): rarely-changed settings stay folded. */}
          <details className="kg-settings__advanced" data-agent-id="settings.advanced">
            <summary className="kg-settings__advanced-summary">
              <Icon name="Settings" size={20} />
              <span>{t('advanced.title')}</span>
              <Icon name="ChevronDown" size={20} />
            </summary>
            <SettingsSection id="settings-swipe" icon="Hand" title={t('swipe.title')}>
              <p className="kg-settings__hint">{t('swipe.hint')}</p>
              {(['left', 'right'] as const).map((side) => (
                <Fragment key={side}>
                  <span className="kg-settings__label" id={`settings-swipe-${side}-label`}>
                    {t(`swipe.${side}`)}
                  </span>
                  <SegmentedControl
                    aria-labelledby={`settings-swipe-${side}-label`}
                    agentId={`settings.swipe-${side}`}
                    agentAction="settings.setSwipeAction"
                    value={side === 'left' ? swipeLeftAction : swipeRightAction}
                    onChange={(option) => setSwipeAction(side, option)}
                    options={SWIPE_ACTION_OPTIONS.map((option) => ({
                      value: option,
                      label: t(`swipe.action_${option}`),
                    }))}
                  />
                </Fragment>
              ))}
            </SettingsSection>
            <SettingsSection id="settings-haptics" icon="Vibrate" title={t('haptics.title')}>
              <Toggle
                enabled={hapticsEnabled}
                label={t('haptics.enabled')}
                onChange={setHapticsEnabled}
                agentId="settings.haptics-enabled"
              />
              <p className="kg-settings__hint">{t('haptics.enabled_hint')}</p>
            </SettingsSection>
          </details>

          <SettingsSection id="settings-about" icon="Info" title={t('about.title')}>
            {/* First-run journey: the welcome tour, again, on the Documents screen. */}
            <ListRow
              icon="Hand"
              title={t('about.replay_tour')}
              hint={t('about.replay_tour_hint')}
              onClick={() => {
                forgetTip(WELCOME_TOUR_TIP);
                router.push('/vault', 'root', 'replace');
              }}
              agentId="settings.replay-tour"
            />
            {ABOUT_LINKS.map(([doc, labelKey, icon]) => (
              <ListRow
                key={doc}
                icon={icon}
                title={t(labelKey)}
                onClick={() => router.push(`/legal/${doc}`)}
                agentId={`settings.about-${doc}`}
              />
            ))}
            <p className="kg-settings__hint" data-agent-id="settings.about-version">
              {t('about.version', { version: APP_VERSION })}
            </p>
          </SettingsSection>

          {/* SE-3: the most destructive action is last and lowest-weight. */}
          <SettingsSection id="settings-danger" icon="AlertCircle" title={t('data.danger_title')} danger>
            <ListRow
              icon="Trash2"
              tone="danger"
              title={t('data.delete_all')}
              hint={t('data.delete_all_hint')}
              onClick={() => setEraseOpen(true)}
              agentId="settings.delete-all-data"
            />
          </SettingsSection>
        </main>

        <DeleteAllDataDialog isOpen={eraseOpen} onDismiss={() => setEraseOpen(false)} />

        {/* Restore preview — nothing is written until the user confirms
           (useBackupRestore's pickBackup() only decrypts + parses). */}
        <Alert
          isOpen={restore.status === 'confirming' && restore.preview !== null}
          header={t('data.restore_confirm_title')}
          message={
            restore.preview
              ? t('data.restore_confirm_body', {
                  count: restore.preview.counts.documents,
                  folders: restore.preview.counts.folders,
                  date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                    new Date(restore.preview.createdAt)
                  ),
                })
              : ''
          }
          agentId="settings.restore-confirm"
          onDidDismiss={() => restore.cancel()}
          buttons={[
            {
              text: t('data.restore_confirm_button'),
              handler: (): void => {
                void restore.confirmRestore();
              },
            },
            { text: t('data.cancel'), role: 'cancel' },
          ]}
        />
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
