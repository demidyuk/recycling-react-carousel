/* global document */
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const packageFixtures = join(root, 'scripts/fixtures/package');
const temporaryRoot = mkdtempSync(join(tmpdir(), 'recycling-carousel-pack-'));
const browserChecks = process.argv.includes('--browser');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const nodeModulesBin =
  process.platform === 'win32'
    ? join('node_modules', '.bin', 'tsc.cmd')
    : join('node_modules', '.bin', 'tsc');

const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

const testBrowserConsumer = async (fixture, reactVersion) => {
  const { build } = await import('vite');
  const { chromium, webkit, expect } = await import('@playwright/test');
  copyFileSync(
    join(root, 'scripts/fixtures/package-consumer.mjs'),
    join(fixture, 'app.mjs')
  );
  copyFileSync(
    join(packageFixtures, 'server.mjs'),
    join(fixture, 'server.mjs')
  );
  copyFileSync(
    join(packageFixtures, 'client.mjs'),
    join(fixture, 'client.mjs')
  );
  const html = run(process.execPath, ['server.mjs'], fixture);
  if (!html.includes('First slide')) {
    throw new Error(
      'The packed component did not render its explicit SSR slide'
    );
  }
  await build({
    configFile: false,
    root: fixture,
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: 'browser-dist',
      lib: {
        entry: join(fixture, 'client.mjs'),
        name: 'PackageConsumer',
        formats: ['iife'],
        fileName: () => 'consumer.js',
      },
    },
  });
  writeFileSync(
    join(fixture, 'index.html'),
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Package consumer</title></head><body><div id="app">${html}</div><script src="./browser-dist/consumer.js"></script></body></html>`
  );

  copyFileSync(
    join(packageFixtures, 'hook-only.mjs'),
    join(fixture, 'hook-only.mjs')
  );
  await build({
    configFile: false,
    root: fixture,
    logLevel: 'warn',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      outDir: 'hook-only-dist',
      lib: {
        entry: join(fixture, 'hook-only.mjs'),
        name: 'HookOnlyConsumer',
        formats: ['iife'],
        fileName: () => 'consumer.js',
      },
    },
  });
  const hookBundle = readFileSync(
    join(fixture, 'hook-only-dist/consumer.js'),
    'utf8'
  );
  if (
    hookBundle.includes('prefers-reduced-motion: reduce') ||
    hookBundle.includes('data-carousel-slide')
  ) {
    throw new Error(
      'The hook-only consumer retained carousel rendering or motion'
    );
  }
  writeFileSync(
    join(fixture, 'hook-only.html'),
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Hook consumer</title></head><body><div id="app"></div><script src="./hook-only-dist/consumer.js"></script></body></html>'
  );

  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch();
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      await page.goto(pathToFileURL(join(fixture, 'index.html')).href);
      expect(errors).toEqual([]);
      await expect(page.getByRole('button', { name: 'Next' })).toBeEnabled();
      await expect(
        page.locator('style[data-recycling-react-carousel]')
      ).toHaveCount(1);
      await expect(page.locator('#carousel')).toHaveCSS('position', 'relative');
      await expect(page.locator('#carousel')).toHaveCSS(
        'overflow',
        /^(hidden|clip)$/
      );
      await expect(page.locator('#carousel > div').first()).toHaveCSS(
        'position',
        'absolute'
      );
      await expect
        .poll(() =>
          page.locator('#carousel').evaluate((root) => {
            const first = root
              .querySelector('#first-slide')
              ?.getBoundingClientRect();
            const second = root
              .querySelector('#second-slide')
              ?.getBoundingClientRect();
            if (!first || !second) return Infinity;
            return Math.max(
              Math.abs(first.width - 320),
              Math.abs(second.left - first.right - 16)
            );
          })
        )
        .toBeLessThan(1);
      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('#cursor')).toHaveText('1');
      await expect
        .poll(() =>
          page.locator('#second-slide').evaluate((slide) => {
            const viewport = document
              .getElementById('carousel')
              .getBoundingClientRect();
            return Math.abs(slide.getBoundingClientRect().left - viewport.left);
          })
        )
        .toBeLessThan(1);
      await page.getByRole('button', { name: 'Previous' }).click();
      await expect(page.locator('#cursor')).toHaveText('0');
      await expect(page.locator('#probe-absolute-index')).toHaveText('100');
      await expect(page.locator('#probe-local-index')).toHaveText('1');
      await page.getByRole('button', { name: 'Select local slide 2' }).click();
      await expect(page.locator('#probe-absolute-index')).toHaveText('101');
      await expect(page.locator('#probe-local-index')).toHaveText('2');
      await page
        .getByRole('button', { name: 'Advance absolute index' })
        .click();
      await expect(page.locator('#probe-absolute-index')).toHaveText('102');
      await expect(page.locator('#probe-local-index')).toHaveText('0');
      expect(await page.evaluate(() => globalThis.hydrationErrors)).toEqual([]);
      expect(errors).toEqual([]);

      await page.goto(pathToFileURL(join(fixture, 'hook-only.html')).href);
      await expect(page.locator('#hook-ready')).toHaveText('false');
      await expect(
        page.locator('style[data-recycling-react-carousel]')
      ).toHaveCount(1);
      expect(errors).toEqual([]);
      process.stdout.write(
        `Packed React ${reactVersion} ${browserType.name()}: CSS, SSR hydration, navigation, controller indexes, and hook-only tree shaking passed\n`
      );
    } finally {
      await browser.close();
    }
  }
};

try {
  const notice = readFileSync(join(root, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  const license = notice.slice(notice.indexOf('MIT License')).trim();
  const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();
  for (const filename of ['index.js', 'index.cjs']) {
    const output = readFileSync(join(root, 'dist', filename), 'utf8');
    if (!normalizeWhitespace(output).includes(normalizeWhitespace(license))) {
      throw new Error(
        `${filename} does not preserve the third-party MIT notice`
      );
    }
  }
  const bundle = readFileSync(join(root, 'dist', 'index.js'), 'utf8');
  if (!bundle.includes('data-recycling-react-carousel')) {
    throw new Error('The published ESM bundle does not contain automatic CSS');
  }

  const packResult = JSON.parse(
    run(npm, ['pack', '--json', '--pack-destination', temporaryRoot], root)
  )[0];
  const packedFiles = new Set(packResult.files.map(({ path }) => path));
  for (const requiredFile of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'THIRD_PARTY_NOTICES.md',
  ]) {
    if (!packedFiles.has(requiredFile)) {
      throw new Error(`Packed artifact is missing ${requiredFile}`);
    }
  }

  const tarball = join(temporaryRoot, packResult.filename);

  for (const reactMajor of [18, 19]) {
    const fixture = join(temporaryRoot, `react-${reactMajor}`);
    mkdirSync(fixture);

    writeFileSync(
      join(fixture, 'package.json'),
      JSON.stringify(
        {
          private: true,
          type: 'module',
        },
        null,
        2
      )
    );

    const reactVersion = reactMajor === 18 ? '18.0.0' : '19.2.7';
    run(
      npm,
      [
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball,
        `react@${reactVersion}`,
        `react-dom@${reactVersion}`,
        `@types/react@${reactMajor}`,
        `@types/react-dom@${reactMajor}`,
        'typescript@~6.0.3',
      ],
      fixture
    );

    copyFileSync(
      join(packageFixtures, 'import.mjs'),
      join(fixture, 'import.mjs')
    );
    copyFileSync(
      join(packageFixtures, 'require.cjs'),
      join(fixture, 'require.cjs')
    );
    copyFileSync(
      join(packageFixtures, 'typecheck.tsx'),
      join(fixture, 'typecheck.tsx')
    );
    copyFileSync(
      join(packageFixtures, 'typecheck.cts'),
      join(fixture, 'typecheck.cts')
    );
    copyFileSync(
      join(packageFixtures, 'tsconfig.json'),
      join(fixture, 'tsconfig.json')
    );

    run(process.execPath, ['import.mjs'], fixture);
    run(process.execPath, ['require.cjs'], fixture);
    run(nodeModulesBin, ['--project', 'tsconfig.json'], fixture);
    if (browserChecks) await testBrowserConsumer(fixture, reactVersion);
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
