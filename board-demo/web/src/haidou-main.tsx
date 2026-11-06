import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import HaidouApp from './haidou/HaidouApp';

document.body.classList.add('haidou-body');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HaidouApp />
  </StrictMode>,
);
