export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 72],
    "type-enum": [
      2,
      "always",
      ["feat", "fix", "chore", "docs", "test", "refactor", "perf", "ci", "build"],
    ],
  },
};
