import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  const params = new URLSearchParams(location.search);
  // 見本データを書き終えてから描く(待たないと、空の記録を先に読んでしまう)
  if (params.get('demo')) await (await import('./dev/demo')).installDemo(params);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
