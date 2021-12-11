module.exports = {
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'babel',
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  testTimeout: 2000,
  transform: {
    '^.+\\.[t|j]s$': 'babel-jest'
  }
};
