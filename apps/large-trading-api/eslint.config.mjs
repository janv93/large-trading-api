import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';

export default [
  { languageOptions: { globals: globals.browser } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
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
      'unused-imports/no-unused-imports': 'error',
      'prefer-const': 'warn',
      'no-empty': 'warn',
    },
  },
];
