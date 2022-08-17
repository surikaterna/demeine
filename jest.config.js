/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  transform: {
    '^.+\\.[t|j]s$': '@swc/jest'
  },
  testMatch: [
    '**/?(*.)+(spec|test).[jt]s?(x)'
  ],
  moduleFileExtensions: ['ts', 'js'],
  clearMocks: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  testTimeout: 2000,
  setupFiles: [
    './jest-setup.ts'
  ]
};
