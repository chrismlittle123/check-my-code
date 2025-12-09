// ESLint config with weaker severity than required - should fail
export default [
  {
    rules: {
      // Ruleset requires "error", config has "warn" - weaker is NOT allowed
      "no-console": "warn",
    },
  },
];
