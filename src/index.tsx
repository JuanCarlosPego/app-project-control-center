import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { margin: 0; padding: 0; height: 100%; }
`;
document.head.appendChild(style);

const container = document.getElementById('root');
if (!container) throw new Error('No se encontró el elemento #root');

async function bootstrap() {
  // Activar mocks solo cuando VITE_USE_MOCKS=true
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    // Intentar Service Worker (funciona en local dev)
    const supportsServiceWorker =
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

    let swStarted = false;
    if (supportsServiceWorker) {
      try {
        const { worker } = await import('./mock/browser');
        await worker.start({ onUnhandledRequest: 'bypass' });
        swStarted = true;
        console.info('[MSW] Service Worker activo');
      } catch {
        console.warn('[MSW] Service Worker no disponible, usando interceptor de fetch');
      }
    }

    // Fallback: interceptor puro (sin SW) — funciona en Power Apps, iframes, etc.
    if (!swStarted) {
      const { startMockInterceptor } = await import('./mock/interceptor');
      await startMockInterceptor();
    }
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
