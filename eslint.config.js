import reactHooks from 'eslint-plugin-react-hooks';
import typescriptEslintParser from '@typescript-eslint/parser';

export default [
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    plugins: {
      'react-hooks': reactHooks.default || reactHooks,
    },
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    }
  }
];
