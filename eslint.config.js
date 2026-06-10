// ESLint 10 flat config — rules per CONTRIBUTING.md §Code Style & Linting.
import eslint from '@eslint/js';
import { fixupConfigRules } from '@eslint/compat';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import { importX, createNodeResolver } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/dist/',
      '**/coverage/',
      '**/node_modules/',
      '**/android/',
      '**/ios/',
      '**/.astro/',
      'scripts/',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  // eslint-plugin-react and jsx-a11y still use pre-v10 context APIs
  // (context.getFilename etc.) — fixupConfigRules bridges them to ESLint 10.
  // Drop the wrappers once https://github.com/jsx-eslint/eslint-plugin-react/issues/3977 ships.
  ...fixupConfigRules(react.configs.flat.recommended),
  ...fixupConfigRules(react.configs.flat['jsx-runtime']),
  reactHooks.configs.flat['recommended-latest'],
  ...fixupConfigRules(jsxA11y.flatConfigs.recommended),
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      // 'detect' can't see apps/kagaz's react from the workspace root —
      // keep in sync with apps/kagaz/package.json.
      react: { version: '19.2' },
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          project: [
            'apps/kagaz/tsconfig.app.json',
            'apps/kagaz/tsconfig.node.json',
          ],
          noWarnOnMultipleProjects: true,
        }),
        createNodeResolver(),
      ],
    },
    rules: {
      // Use the structured logger (docs/architecture/14-observability-logging.md), never console.log
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // tseslint.config()/tseslint.configs.* is the documented typescript-eslint
    // API — import-x's named-export caution is a false positive here.
    files: ['eslint.config.js'],
    rules: {
      'import-x/no-named-as-default-member': 'off',
    },
  }
);
