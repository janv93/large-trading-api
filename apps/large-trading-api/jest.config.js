module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  globals: {
    "ts-jest": {
      isolatedModules: true
    }
  },
  moduleNameMapper: {
    "^@shared$": "<rootDir>/../../libs/shared/src/index.ts",
    "^@large-trading-api/shared$": "<rootDir>/../../libs/shared/src/index.ts"
  }
};