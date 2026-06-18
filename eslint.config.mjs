import nextEslintConfig from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "examples/**",
      "playwright-report/**",
      "test-results/**",
      ".venv-*/**",
      "**/.pytest_cache/**",
      "**/__pycache__/**",
      "packages/**/dist/**",
    ],
  },
  ...nextEslintConfig,
  {
    rules: {
      "prefer-const": "error",
      "no-var": "error",
      // react-hooks/purity is overly strict for server components that
      // legitimately call Date.now() for request-time timestamps and for
      // event handlers that use Math.random() for mock data generation.
      "react-hooks/purity": "warn",
    },
  },
];

export default eslintConfig;
