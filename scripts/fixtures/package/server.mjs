import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { App } from './app.mjs';
process.stdout.write(renderToString(createElement(App)));
