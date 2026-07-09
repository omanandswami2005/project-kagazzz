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
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@kagaz/ui';
import { useTheme, type ThemeSetting } from '@/app/providers/ThemeProvider';
import './settings.css';

const THEME_OPTIONS: readonly ThemeSetting[] = ['system', 'light', 'dark'];

/** The app Settings page. */
export function SettingsPage(): ReactNode {
  const { t } = useTranslation('settings');
  const { theme, setTheme } = useTheme();

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
        </main>
      </IonContent>
    </IonPage>
  );
}

export default SettingsPage;
