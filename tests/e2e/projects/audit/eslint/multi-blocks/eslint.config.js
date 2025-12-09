// ESLint config with multiple rules blocks (like real-world configs)
export default [
  // First config block for source files
  {
    files: ["src/**/*.js"],
    rules: {
      "no-console": "error",
      "no-var": "error",
    },
  },
  // Second config block for test files
  {
    files: ["tests/**/*.js"],
    rules: {
      "prefer-const": "error",
      // Tests may use console
      "no-console": "off",
    },
  },
];
