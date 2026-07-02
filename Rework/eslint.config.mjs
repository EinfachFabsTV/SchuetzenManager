import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/generated/**", "apps/desktop/src-tauri/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["apps/backend/**/*.ts"],
    languageOptions: { globals: globals.node },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/desktop/scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The "reset display state, then kick off an async fetch" effect
      // pattern used throughout (OverviewTab, SeasonView, ShootersTab -
      // clear stale data when the id prop changes, before re-fetching) is
      // exactly what effects are for, but this rule flags any synchronous
      // setState call in an effect body regardless of intent.
      "react-hooks/set-state-in-effect": "off",
      "react-refresh/only-export-components": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
