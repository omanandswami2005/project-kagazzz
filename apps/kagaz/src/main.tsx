/**
 * App entry point (P0-10). Order matters: tokens before component styles.
 */
import './core/polyfills/pdfjs-runtime-polyfills';
import { createRoot } from 'react-dom/client';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
// Ionic's full dark palette, activated by the `ion-palette-dark` class on
// <html> (toggled in ThemeProvider). Without it only a handful of --ion-*
// vars are themed and remaining Ionic components (IonPage/IonHeader/
// IonToolbar/IonContent chrome, IonModal — IonActionSheet/IonSelect/
// IonAlert/IonSearchbar are all gone now, replaced by @kagaz/ui atoms,
// G1-4 complete) fall back to light defaults — unreadable in dark mode.
import '@ionic/react/css/palettes/dark.class.css';
import '@kagaz/design-tokens/css';
import '@kagaz/ui/styles.css';
import './app/app.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}
createRoot(container).render(<App />);
