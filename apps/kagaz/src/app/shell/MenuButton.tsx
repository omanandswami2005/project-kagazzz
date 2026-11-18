/** ☰ in a tab root's header: opens the side drawer ({@link AppMenu}). */
import { IonButtons, IonMenuButton } from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** Header start slot with the drawer toggle. */
export function MenuButton(): ReactNode {
  const { t } = useTranslation('common');
  return (
    <IonButtons slot="start">
      <IonMenuButton aria-label={t('menu.open')} data-agent-id="app.menu-button" />
    </IonButtons>
  );
}
