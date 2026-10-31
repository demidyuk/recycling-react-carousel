import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage/**',
      'dist/**',
      'storybook-static/**',
      'storybook-internal-static/**',
      'storybook-test-static/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.{ts,tsx,cts}'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'react-hooks/exhaustive-deps': 'error',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
  {
    // These consumers are compiled separately against the packed declarations.
    files: ['scripts/fixtures/package/typecheck.{tsx,cts}'],
    rules: { '@typescript-eslint/no-unused-vars': 'off' },
  },
  {
    // Exercise the actual CommonJS consumer syntax at the package boundary.
    files: ['scripts/fixtures/package/*.{cjs,cts}'],
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
      },
    },
  }
);
