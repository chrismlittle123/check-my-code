// ESLint config using array format with options
export default [
  {
    rules: {
      // Array format with options - should match "error"
      "eqeqeq": ["error", "always"],
      // Array format - should match "warn"
      "no-console": ["warn", { allow: ["error", "warn"] }],
    },
  },
];
