// ESLint config with deeply nested rule options (tests brace matching)
export default [
  {
    rules: {
      "no-var": "error",
      "prefer-const": "error",
      // Rule with nested options object
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Another rule with nested array in options
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message: "Use lodash-es instead",
            },
          ],
        },
      ],
    },
  },
];
