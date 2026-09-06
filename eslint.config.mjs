import pluginJs from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**', '**/.angular/**', '.nx/**', 'tmp/**'] },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/large-trading-api/**/*.ts', '**/*.{js,cjs,mjs}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/large-trading-api-frontend/**/*.ts'],
    languageOptions: { globals: globals.browser },
  },
  {
    languageOptions: {
      parserOptions: { tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/ban-types': 'off',
      'no-case-declarations': 'off',
      'no-constant-condition': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none' }],
      '@typescript-eslint/member-ordering': [
        'error',
        {
          default: [
            'public-field',
            'protected-field',
            'private-field',
            'constructor',
            'public-method',
            'protected-method',
            'private-method',
          ],
        },
      ],
      'prefer-const': 'warn',
      'no-empty': 'warn',
    },
  },
];
