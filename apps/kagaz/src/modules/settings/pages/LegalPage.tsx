/**
 * In-app legal & attribution screens (G1-5): Privacy Policy, Terms &
 * Conditions, and Open-source licenses, reached from Settings → About. The
 * legal text is bundled (offline) from `../content/*.md` — copies of the
 * canonical `docs/legal/*.md` (keep both in sync); the licenses list is
 * generated from the app's dependencies by `scripts/gen-licenses.mjs`.
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
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MarkdownView } from '../components/MarkdownView';
import privacyMd from '../content/privacy-policy.md?raw';
import termsMd from '../content/terms-and-conditions.md?raw';
import licenses from '../content/third-party-licenses.json';
import './legal.css';

/** The three legal documents this page can show. */
export type LegalDoc = 'privacy' | 'terms' | 'licenses';

const TITLE_KEY = {
  privacy: 'about.privacy_policy',
  terms: 'about.terms',
  licenses: 'about.licenses',
} as const satisfies Record<LegalDoc, string>;

/** One legal/attribution document, chosen by the `:doc` route param. */
export function LegalPage(): ReactNode {
  const { t } = useTranslation('settings');
  const { doc } = useParams<{ doc: LegalDoc }>();
  const title = t(TITLE_KEY[doc] ?? 'about.title');

  return (
    <IonPage data-agent-id="settings.legal">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/settings" data-agent-id="settings.legal.back" />
          </IonButtons>
          <IonTitle>{title}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-legal" data-agent-id="settings.legal.content" data-doc={doc}>
          {doc === 'licenses' ? (
            <>
              <p className="kg-legal__intro">{t('about.licenses_intro')}</p>
              <ul className="kg-legal__licenses" data-agent-id="settings.legal.licenses">
                {licenses.map((lib) => (
                  <li key={lib.name} className="kg-legal__license">
                    <span className="kg-legal__lib">
                      {lib.name}
                      {lib.version ? ` ${lib.version}` : ''}
                    </span>
                    <span className="kg-legal__spdx">{lib.license}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <MarkdownView source={doc === 'terms' ? termsMd : privacyMd} />
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default LegalPage;
