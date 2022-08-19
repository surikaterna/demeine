/** @type { import('@jest/types').Config.InitialOptions } */
module.exports = {
  transform: {
    '^.+\\.ts$': '@swc/jest'
  },
  testMatch: [
    '**/?(*.)+(spec|test).ts'
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
