import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Prevent copy / cut from keyboard (Ctrl+C, Ctrl+X, ⌘C, ⌘X)
// Inputs and textareas are excluded so users can still interact normally.
document.addEventListener('copy', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea')) return;
  e.preventDefault();
});
document.addEventListener('cut', (e) => {
  if ((e.target as HTMLElement).closest('input, textarea')) return;
  e.preventDefault();
});
// When a new service worker takes over after a deploy, reload once to serve fresh assets.
// Only fires on UPDATE (a controller already existed) — not on first-time SW installation,
// which would otherwise interrupt the PWA install flow and cause an infinite hang.
if ('serviceWorker' in navigator) {
  const prevController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!prevController) return; // first-time activation — skip reload
    if (sessionStorage.getItem('sw-reloaded')) return;
    sessionStorage.setItem('sw-reloaded', '1');
    window.location.reload();
  });
}

// Block context menu (right-click) to prevent "Copy" from context menu
// Only active in production — dev mode keeps right-click for DevTools
if (import.meta.env.PROD) {
  document.addEventListener('contextmenu', (e) => {
    if ((e.target as HTMLElement).closest('input, textarea')) return;
    e.preventDefault();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
