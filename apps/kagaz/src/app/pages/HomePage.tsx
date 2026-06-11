/**
 * Shell home page (P0-10). Placeholder until F-1 lands VaultHomePage —
 * but a full citizen of the agent contract (sibling .agent.ts +
 * .skill.md; agent:lint enforces this for every page).
 */
import { IonContent, IonPage } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/** Landing screen: greets the user; vault arrives with F-1. */
export function HomePage(): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <IonPage data-agent-id="app.home">
      <IonContent>
        <main className="kg-home" data-agent-id="app.home.content">
          <h1>{t('title')}</h1>
          <p data-agent-id="app.home.empty-message">
            {t('empty_state.message')}
          </p>
          <p>{t('empty_state.hint')}</p>
        </main>
      </IonContent>
    </IonPage>
  );
}

export default HomePage;
