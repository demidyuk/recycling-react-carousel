module.exports = {
  moduleNameMapper: {
    '\\.(css|scss)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/test-config/setupTests.ts'],
  coveragePathIgnorePatterns: ['<rootDir>/src/index.ts', '__tests__'],
};
