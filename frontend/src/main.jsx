import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

try {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    const el = document.createElement('div');
    el.id = 'root';
    document.body.appendChild(el);
  }
  // Clear fallback content before React mounts
  try { document.getElementById('root').innerHTML = ''; } catch {}
  // Visual indicator to ensure JS is running
  const banner = document.createElement('div');
  banner.textContent = 'Memuat aplikasi...';
  banner.style.position = 'fixed';
  banner.style.top = '10px';
  banner.style.left = '10px';
  banner.style.padding = '8px 12px';
  banner.style.background = '#fffa90';
  banner.style.border = '1px solid #e5e500';
  banner.style.zIndex = '9999';
  document.body.appendChild(banner);

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  // Remove banner after a short delay
  setTimeout(() => { try { document.body.removeChild(banner); } catch {} }, 1500);
} catch (err) {
  const pre = document.createElement('pre');
  pre.textContent = 'Render error: ' + String(err);
  pre.style.padding = '24px';
  document.body.appendChild(pre);
}
