// ESLint config with intentional mismatches
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  rules: {
    'no-var': 'error',
    // Missing: prefer-const
    // Missing: eqeqeq
    'no-console': 'warn',  // Extra rule not in cmc.toml
  },
});
