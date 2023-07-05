module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'prettier', 'import'],
  extends: [
    'airbnb-base',
    'airbnb-typescript/base',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    'comma-dangle': ['error', 'only-multiline'],
    'object-curly-newline': ['error', { consistent: true }],
    'prettier/prettier': ['error', { endOfLine: 'auto' }],
    'import/prefer-default-export': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    'no-plusplus': [2, { allowForLoopAfterthoughts: true }],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'max-len': ['warn', { code: 120 }],
    indent: [
      'warn',
      2,
      {
        SwitchCase: 1,
      },
    ],
    '@typescript-eslint/indent': [
      'warn',
      2,
      {
        SwitchCase: 1,
      },
    ],
    'no-param-reassign': [
      'error',
      {
        props: false,
      },
    ],
  },
};
