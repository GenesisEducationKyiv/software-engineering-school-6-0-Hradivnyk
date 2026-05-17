const baseConfig = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: './tsconfig.test.json' }],
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};

module.exports = {
  ...baseConfig,
  testMatch: ['**/__tests__/**/*.test.ts', '**/tests/integration/**/*.test.ts'],
  projects: [
    {
      ...baseConfig,
      displayName: 'unit',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts'],
    },
    {
      ...baseConfig,
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      globalSetup: '<rootDir>/tests/integration/global-setup.ts',
      // overrides baseConfig.setupFiles — loads .env.test before any imports
      setupFiles: ['<rootDir>/tests/integration/env-setup.ts'],
    },
  ],
};
