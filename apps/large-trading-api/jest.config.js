module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["@swc/jest", {
      jsc: {
        parser: {
          syntax: "typescript"
        },
        target: "es2022"
      },
      module: {
        type: "commonjs"
      }
    }]
  },
  moduleNameMapper: {
    "^@shared$": "<rootDir>/../../libs/shared/src/index.ts",
    "^@large-trading-api/shared$": "<rootDir>/../../libs/shared/src/index.ts"
  }
};