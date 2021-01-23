module.exports = {
  roots: ['<rootDir>/src'],
  setupFiles: [
    './jest-setup.ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  testRegex: '(./test/*|(\\.|/)(test|spec))\\.ts$',
  moduleDirectories: ['node_modules', 'src'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node']
};
