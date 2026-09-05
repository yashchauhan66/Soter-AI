import nextEslintConfig from "eslint-config-next";
import reactHooks from "eslint-plugin-react-hooks";
import typescriptEslint from "typescript-eslint";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      ".claude/**",
      ".agent/**",
      ".tmp/**",
      "tmp/**",
      "tmpsoterai-code-clean/**",
      "node_modules/**",
      "next-env.d.ts",
      "examples/**",
      "**/dist/**",
      // Build and host-test artifacts. All three are gitignored regenerable
      // output, and linting them is what made `eslint .` unusable: the ~350 MB
      // VS Code that the extension host suite downloads into
      // packages/vscode-extension/.vscode-test/ contributed 99 files and ~39,500
      // errors of VS Code's own bundled JavaScript, and parsing it exhausted the
      // 4 GB V8 heap before the run could finish.
      "**/.vscode-test/**",
      "**/dist-test/**",
      "**/test-build/**",
      // Maven / Gradle output under the IDE extensions.
      "**/target/**",
      "**/build/classes/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "AppData/**",
      ".venv-*/**",
      "**/.pytest_cache/**",
      "**/pytest-cache-files-*/**",
      "**/__pycache__/**",
      "extensions/jupyterlab/lib/**",
      "extensions/jupyterlab/soterai_jupyterlab_guard/labextension/static/**",
      "real-user-review-evidence/**",
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
      // Apostrophes/quotes in JSX text render fine; this rule is pure style noise.
      "react/no-unescaped-entities": "off",
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
