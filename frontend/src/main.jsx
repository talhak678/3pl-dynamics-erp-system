import { createRoot } from 'react-dom/client';

import RootApp from './RootApp';
import { ThemeProvider } from './context/ThemeContext';

const root = createRoot(document.getElementById('root'));
root.render(
  <ThemeProvider>
    <RootApp />
  </ThemeProvider>
);
