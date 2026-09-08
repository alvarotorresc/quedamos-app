import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { setupIonicReact } from '@ionic/react';
import './i18n';
import App from './App';
import { warnMissingEnvVars } from './lib/env';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import './index.css';

setupIonicReact({
  mode: 'ios',
});

// Before anything reads them. Unconditional (not DEV-only): a build shipped without one
// of these degrades in silence — no push token, no Firebase, an API base URL of
// "undefined" — and the console is the only place that shows up in production.
warnMissingEnvVars();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
