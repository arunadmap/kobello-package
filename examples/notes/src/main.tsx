import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { kobello } from '@kobello/sdk';
import App from './App';
import './styles.css';

async function start() {
  // While developing in a normal browser (npm run dev), there's no Kobello desktop app.
  // The mock stands in for it, in memory, so you can still click around. It's left out of production builds.
  if (import.meta.env.DEV && !kobello.isAvailable()) {
    const { installMock } = await import('@kobello/sdk/mock');
    installMock({ app: { id: 'dev.kobello.notes', name: 'Notes' } });
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
}

void start();
