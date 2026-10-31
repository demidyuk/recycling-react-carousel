import { resolve } from 'node:path';
import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';

const profile = process.env.CAROUSEL_STORYBOOK_PROFILE ?? 'public';
const publicStories = '../stories/RCarousel/*.stories.@(js|jsx|mjs|ts|tsx)';
const profiles: Record<string, string[]> = {
  public: [publicStories],
  test: [publicStories, '../e2e/fixtures/*.stories.@(js|jsx|mjs|ts|tsx)'],
};

if (!profiles[profile]) {
  throw new Error(`Unknown Storybook profile: ${profile}`);
}

const config: StorybookConfig = {
  stories: profiles[profile],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  docs: {
    autodocs: 'tag',
  },
  async viteFinal(viteConfig) {
    viteConfig.plugins = viteConfig.plugins
      ?.flat(3)
      .filter(
        (plugin) =>
          !plugin ||
          typeof plugin !== 'object' ||
          !('name' in plugin) ||
          typeof plugin.name !== 'string' ||
          !plugin.name.startsWith('vite-plugin-css-injected-by-js')
      ) as typeof viteConfig.plugins;

    return mergeConfig(viteConfig, {
      server: {
        watch: {
          // Reports and builds must not reload a story during a browser test.
          ignored: [
            '**/coverage/**',
            '**/dist/**',
            '**/storybook*-static/**',
            '**/test-results/**',
            '**/playwright-report/**',
          ],
        },
      },
      cacheDir: resolve(
        import.meta.dirname,
        `../node_modules/.cache/carousel-${profile}`
      ),
      build: {
        target: 'es2020',
      },
      resolve: {
        alias: {
          'recycling-react-carousel': resolve(
            import.meta.dirname,
            '../src/index.ts'
          ),
        },
      },
    });
  },
};

export default config;
