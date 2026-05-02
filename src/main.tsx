import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './lib/auth';

window.addEventListener('error', (e) => {
  if (
    e.message === 'ResizeObserver loop limit exceeded' ||
    e.message === 'ResizeObserver loop completed with undelivered notifications.'
  ) {
    return;
  }
  console.error("GLOBAL ERROR:", e.error?.stack || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error("GLOBAL PROMISE ERROR:", e.reason);
});

createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
