# Development

[README](../README.md) · [API reference](api.md) · [Repository instructions](../AGENTS.md)

## Setup

Use Node 24 and npm:

```sh
nvm use
npm ci
```

The published package supports Node >=22.18.0 and React/React DOM 18 and 19.
Repository tooling uses Node 24.

## Validation

Run these checks in order; builds and reports can interrupt browser tests:

```sh
npm run check
npm run test:browser
npm run test:package:browser
npm run build-storybook
```

`check` runs formatting, linting, TypeScript, unit tests with coverage, the library
build, size limits, package metadata checks, and packed ESM/CommonJS consumers on
React 18.0 and 19. It also checks accepted and rejected TypeScript usage against
the built declarations.

`size` measures minified Brotli output with React and React DOM excluded. Limits
in [`package.json`](../package.json) cover ESM, CommonJS, and `useCarousel`
imports.

Use `npm test -- <file>` for focused unit tests, or `npm run test:watch` while
working. Shared test setup unmounts components before restoring spies, browser
globals, and timers. Layout stubs and manual animation clocks live in
`test-config`; tests of the real resize observer retain their own observer setup.

`test:browser` uses Chromium, focused WebKit coverage, and mobile Chromium touch
checks. Gesture, animation, resize, and boundary changes need browser validation.
Wait for state or geometry to determine readiness. Gesture pacing and pauses
should simulate user input.
Physical-device checks remain useful for gesture changes.

`test:package:browser` additionally verifies injected CSS, SSR, hydration,
controller navigation, and local/global positions in Chromium and WebKit for both
React versions. Build first when running package checks independently:

```sh
npm run build
npm run test:package
npm run test:package:browser
```

Package tests install the tarball into temporary consumer projects and remove
them afterward. Fixtures under `scripts/fixtures/package` are compiled there,
without the repository's source alias. Intentional type errors verify that
invalid API usage is rejected, including removed compatibility APIs.

## Storybook profiles

```sh
npm run storybook
npm run storybook:test
npm run build-storybook
```

The public Storybook contains focused presets with the full carousel configuration
Controls available in every story and copyable starting examples in Docs.
Changing axis or cross-axis sizing also updates demo dimensions and navigation
arrows. Initial-position Controls remount the demo; controlled positions update
the existing carousel. Local and absolute position props remain mutually exclusive.
Keep `rcarousel--...` story IDs stable when changing display names.

Use the width slider to try container breakpoints. Expansion state lives in the
parent, keyed by item ID. The large collection example renders a small pool and
displays its slot count. Infinite loading keeps a loading card at the end of its
items. The next batch replaces that card in place, and a new loading card follows
the batch. Keeping this end card mounted avoids changing geometry when a request
starts. Loading starts when the end card enters the viewport or through Load more
items. It allows one request at a time, cancels timers on unmount, and appends
results during dragging or animation while keeping the current view.
The time picker demonstrates `free-snap`, wheel input, keyboard controls, and
`subscribeMotion` effects. Shared configuration Controls remain available.
See the [usage guide](guide.md#controlled-navigation) for controlled position props.

Playwright starts the test profile using the server settings in
[`playwright.config.ts`](../playwright.config.ts). That profile includes public
examples and regression fixtures. Numbered-card fixtures live in
`e2e/fixtures/technical` and appear in the test-only Feature harness stories.
Geometry and motion tests use these fixtures so presentation changes do not
alter their measurements. The dev watcher excludes generated outputs.
Publish only `storybook-static`, never internal or test profile builds.

## Releases

After validation passes, pushes to `master` publish stable releases and pushes to
`alpha` publish prereleases on npm's `alpha` dist-tag. For example, a breaking
change after 1.3.2 produces `2.0.0-alpha.1` on `alpha`. Pull requests run checks
without publishing. Storybook deployment runs on pushes to `master`.

Keep the release job's branch condition in `.github/workflows/main.yml` aligned
with the branches configured in `.releaserc.json`.

Let semantic-release configure npm authentication through `NPM_TOKEN`. Do not set
`registry-url` in the release job's `actions/setup-node` step: its generated npm
configuration can override semantic-release's token configuration.

## Editing conventions

- Keep relative source imports suffixed with `.js` for emitted ESM and CommonJS
  declarations.
- Use concise JSDoc for non-obvious public behavior, constraints, and units.
  Internal comments explain why a mechanism exists; avoid repeating types or names.
- Preserve browserless imports, StrictMode-safe effects, automatic CSS injection,
  the public exports, and the existing position semantics.
- Add regression coverage for demonstrated bugs. Keep distinct browser geometry
  and numeric motion checks; do not regenerate reference data to make a failure pass.
- Edit source files rather than generated build, coverage, or Playwright output.
  Release history and third-party license text retain their established formats.
