import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import ts from 'typescript';

// Keep the API's existing path aliases in sync with TypeScript.
const { config: tsconfig } = ts.readConfigFile(
  './tsconfig.json',
  ts.sys.readFile,
);
const paths = tsconfig?.compilerOptions?.paths ?? {};

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*[.]spec[.]ts$',
  // NestJS 12 dependencies are ESM-only.
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+[.](t|j)s
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
: ['ts-jest', {
      useESM: true,
      // NodeNext emits CommonJS for .ts in projects without "type:module".
      // Force real ESM output so Jest can import NestJS 12 ESM packages.
      tsconfig: { module: 'ESNext', moduleResolution: 'Bundler' },
    }],
  },
  moduleNameMapper: pathsToModuleNameMapper(paths, { prefix: '<rootDir>/' }),
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    'libs/**/*.(t|j)s',
    'apps/**/*.(t|j)s',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
};

export default config;
