import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },
  js.configs.recommended,
  {
    // Type-aware linting only applies to the TypeScript sources that are part of
    // the tsconfig project. Config files below are linted without type info.
    files: ["src/**/*.ts", "test/**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // The value path must never launder an untyped value into a signed payload.
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "no-console": "off",
    },
  },
  {
    // JS config files (eslint.config.js, commitlint.config.js) are not part of
    // the TypeScript project, so type-checked rules must not run on them.
    files: ["**/*.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
