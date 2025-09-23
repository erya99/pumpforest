// .eslintrc.cjs
module.exports = {
  extends: ["next/core-web-vitals"],
  overrides: [
    {
      files: ["app/api/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
          "warn",
          { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
        ]
      }
    }
  ]
};
