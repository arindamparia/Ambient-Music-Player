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
