/* global document */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { useCarousel } from 'recycling-react-carousel';

function App() {
  const controller = useCarousel();
  return createElement(
    'output',
    { id: 'hook-ready' },
    String(controller.isReady)
  );
}

createRoot(document.getElementById('app')).render(createElement(App));
