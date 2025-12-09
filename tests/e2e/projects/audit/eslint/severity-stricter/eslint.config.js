// ESLint config with stricter severity than required
export default [
  {
    rules: {
      // Ruleset requires "warn", config has "error" - stricter is allowed
      "no-console": "error",
      "prefer-const": "error",
    },
  },
];
