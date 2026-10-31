/* global document */
import { createElement } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { App } from './app.mjs';
globalThis.hydrationErrors = [];
hydrateRoot(document.getElementById('app'), createElement(App), {
  onRecoverableError: (error) => globalThis.hydrationErrors.push(error.message),
});
