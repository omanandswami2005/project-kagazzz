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
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Toggle } from '@kagaz/ui';
import { DeleteAllDataDialog } from '../components/DeleteAllDataDialog';
import {
  useLocale,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@/core/i18n';
import { useLockSettings } from '@/modules/auth/hooks/useLockSettings';
import { AUTO_LOCK_TIMEOUTS } from '@/modules/auth/store/lock.store';
import { useTheme, type ThemeSetting } from '@/app/providers/ThemeProvider';
import './settings.css';

const THEME_OPTIONS: readonly ThemeSetting[] = ['system', 'light', 'dark'];
/** Native names shown in each language's own script (settings namespace keys). */
const LANGUAGE_LABEL = {
  en: 'english',
  hi: 'hindi',
} as const satisfies Record<SupportedLanguage, string>;

/** The app Settings page. */
export function SettingsPage(): ReactNode {
  const { t, i18n } = useTranslation('settings');
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();
  const lock = useLockSettings();
  const [eraseOpen, setEraseOpen] = useState(false);

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
          <section className="kg-settings__section">
            <h2 className="kg-settings__section-title" id="settings-language">
              {t('language.title')}
            </h2>
            <div
              className="kg-settings__choices"
              role="group"
              aria-labelledby="settings-language"
              data-agent-id="settings.language"
              data-agent-state={locale}
            >
              {SUPPORTED_LANGUAGES.map((lng) => (
                <Button
                  key={lng}
                  variant={locale === lng ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => void i18n.changeLanguage(lng)}
                  agentId={`settings.language-${lng}`}
                  agentAction="settings.setLanguage"
                >
                  {t(`language.${LANGUAGE_LABEL[lng]}`)}
                </Button>
              ))}
            </div>
          </section>

          <section className="kg-settings__section">
            <h2 className="kg-settings__section-title" id="settings-appearance">
              {t('appearance.title')}
            </h2>
            <div className="kg-settings__row">
              <span className="kg-settings__label" id="settings-theme-label">
                {t('appearance.theme')}
              </span>
              <div
                className="kg-settings__choices"
                role="group"
                aria-labelledby="settings-theme-label"
                data-agent-id="settings.theme"
                data-agent-state={theme}
              >
                {THEME_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant={theme === option ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setTheme(option)}
                    agentId={`settings.theme-${option}`}
                    agentAction="settings.setTheme"
                  >
                    {t(`appearance.theme_${option}`)}
                  </Button>
                ))}
              </div>
            </div>
          </section>

          <section className="kg-settings__section">
            <h2 className="kg-settings__section-title" id="settings-security">
              {t('security.title')}
            </h2>
            <div className="kg-settings__row">
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
            </div>
            {lock.enabled && (
              <div className="kg-settings__row">
                <span className="kg-settings__label" id="settings-autolock">
                  {t('security.auto_lock')}
                </span>
                <div
                  className="kg-settings__choices"
                  role="group"
                  aria-labelledby="settings-autolock"
                  data-agent-id="settings.auto-lock"
                  data-agent-state={lock.timeout}
                >
                  {AUTO_LOCK_TIMEOUTS.map((option) => (
                    <Button
                      key={option}
                      variant={lock.timeout === option ? 'primary' : 'secondary'}
                      size="sm"
                      onClick={() => lock.setAutoLock(option)}
                      agentId={`settings.auto-lock-${option}`}
                    >
                      {t(`security.auto_lock_${option}`)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="kg-settings__section">
            <h2 className="kg-settings__section-title" id="settings-data">
              {t('data.title')}
            </h2>
            <div className="kg-settings__row">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setEraseOpen(true)}
                agentId="settings.delete-all-data"
              >
                {t('data.delete_all')}
              </Button>
              <p className="kg-settings__hint">{t('data.delete_all_hint')}</p>
            </div>
          </section>
        </main>

        <DeleteAllDataDialog
          isOpen={eraseOpen}
          onDismiss={() => setEraseOpen(false)}
        />
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
