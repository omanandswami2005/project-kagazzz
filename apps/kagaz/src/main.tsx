/**
 * App entry point (P0-10). Order matters: tokens before component styles.
 */
import { createRoot } from 'react-dom/client';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@kagaz/design-tokens/css';
import '@kagaz/ui/styles.css';
import './app/app.css';
import { App } from './app/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root is missing from index.html');
}
createRoot(container).render(<App />);
