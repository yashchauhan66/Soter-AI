import nextEslintConfig from "eslint-config-next";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "typescript-eslint";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "next-env.d.ts",
      "examples/**",
      "**/dist/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      ".venv-*/**",
      "**/.pytest_cache/**",
      "**/pytest-cache-files-*/**",
      "**/__pycache__/**",
    ],
  },
  ...nextEslintConfig,
  {
    plugins: {
      "@typescript-eslint": typescriptEslint.plugin,
      "react-hooks": reactHooks,
    },
    rules: {
      "prefer-const": "error",
      "no-var": "error",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
