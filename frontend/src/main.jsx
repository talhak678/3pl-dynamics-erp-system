import { createRoot } from 'react-dom/client';

import RootApp from './RootApp';
import { ThemeProvider } from './context/ThemeContext';

// Handle dynamic import / chunk loading failures (Vercel deployment updates, WAF 403 challenge, network glitches)
const handleChunkError = (error) => {
  const message =
    (typeof error === 'string' ? error : error?.message || error?.reason?.message || '') + '';
  const isChunkError =
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('dynamically imported module') ||
    message.includes('error loading dynamically imported module');

  if (isChunkError) {
    const lastReload = sessionStorage.getItem('chunk_reload_timestamp');
    const now = Date.now();
    // Guard against infinite reload loops (reload at most once every 10 seconds)
    if (!lastReload || now - Number(lastReload) > 10000) {
      sessionStorage.setItem('chunk_reload_timestamp', String(now));
      window.location.reload();
    }
  }
};

// Vite-specific dynamic import preload error event
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  handleChunkError('Failed to fetch dynamically imported module');
});

// Global unhandled promise rejection listener (catches rejected import() promises)
window.addEventListener('unhandledrejection', (event) => {
  handleChunkError(event.reason);
});

// Global window error listener
window.addEventListener('error', (event) => {
  handleChunkError(event.error || event.message);
});

const root = createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <RootApp />
  </ThemeProvider>
);
