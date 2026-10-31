# Repository Guide

Use Node 24 and npm. The published package supports Node `>=22.18.0`,
React 18, and React 19.

## Commands

```sh
nvm use
npm ci
npm run check
npm run test:browser
npm run build-storybook
```

Use `npm test -- <file>` for focused component tests. Run
`npm run test:package` after changing exports, declarations, dependencies, or
CSS handling.

`storybook` and `build-storybook` use the public examples.
Playwright starts `storybook:test`, which also includes browser regression
fixtures. Publish only the public `storybook-static` output.

## Library documentation

Runtime and carousel behavior:

- [React](https://react.dev/reference/react)
- [Pointer Events](https://www.w3.org/TR/pointerevents3/)
- [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)

Build, stories, and tests:

- [TypeScript](https://www.typescriptlang.org/docs/)
- [Vite](https://vite.dev/guide/)
- [Vitest](https://vitest.dev/guide/)
- [Storybook](https://storybook.js.org/docs)
- [Playwright](https://playwright.dev/docs/intro)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)

## Guardrails

- Preserve the default and named `RCarousel` exports, `useCarousel`, and current
  exported API types. Do not restore removed compatibility APIs.
- Use local `index`, explicit global `absoluteIndex`, and
  `controller={useCarousel()}`. Keep configuration on the component. Defaults are
  one slide, trimmed finite ends, content sizing, and container breakpoints.
- Keep `mode` (`finite`, `loop`, `forward-loop`) and `axis` (`horizontal`,
  `vertical`). Controller navigation methods execute immediately; `goTo` selects
  the nearest local occurrence and `goToAbsolute` selects a global position.
- Keep browserless imports and server rendering free of direct `window` or
  `ResizeObserver` access.
- Keep animation updates out of render and effects idempotent under React
  StrictMode.
- Preserve automatic CSS injection; consumers must not need a stylesheet
  import.
- Keep relative source imports suffixed with `.js` so generated ESM and
  CommonJS declarations resolve correctly.
- Validate gesture, animation, resize, or boundary changes with Playwright.
- Do not edit generated `dist`, `coverage`, `storybook-static`,
  `storybook-internal-static`, `storybook-test-static`, or Playwright output.
