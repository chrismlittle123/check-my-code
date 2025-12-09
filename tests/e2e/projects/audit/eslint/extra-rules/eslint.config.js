// ESLint config with extra rules beyond the required ruleset
export default [
  {
    rules: {
      // Required by cmc.toml
      "no-var": "error",
      // Extra rules not in cmc.toml - should be allowed
      "no-console": "warn",
      "prefer-const": "error",
      "eqeqeq": "error",
    },
  },
];
