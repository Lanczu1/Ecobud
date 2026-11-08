import { reportReactError } from './monitoring/sentry';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Production only, so React keeps its usual console errors during development.
const errorReporting = import.meta.env.PROD
  ? { onUncaughtError: reportReactError, onCaughtError: reportReactError, onRecoverableError: reportReactError }
  : {};

createRoot(document.getElementById('root')!, errorReporting).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
