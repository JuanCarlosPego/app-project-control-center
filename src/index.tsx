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
  // Activar MSW solo cuando VITE_USE_MOCKS=true (entorno local)
  if (import.meta.env.VITE_USE_MOCKS === 'true') {
    const { worker } = await import('./mock/browser');
    await worker.start({
      // No mostrar warning en consola para rutas no interceptadas
      onUnhandledRequest: 'bypass',
    });
    console.info('[MSW] Mocks activos — leyendo datos de src/mock/db.json');
  }

  createRoot(container).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
