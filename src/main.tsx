import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.addEventListener('error', (e) => {
  console.error("GLOBAL ERROR:", e.error?.stack || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error("GLOBAL PROMISE ERROR:", e.reason);
});

createRoot(document.getElementById('root')!).render(
  <App />
);
