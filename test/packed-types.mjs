import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = process.cwd();
const output = mkdtempSync(join(tmpdir(), 'demeine-packed-types-'));
console.log(`Packed declaration evidence: ${output}`);

function run(command, args, cwd, label) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 8 * 1024 * 1024
  });
  writeFileSync(join(output, `${label}.log`), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  assert.ifError(result.error);
  assert.equal(result.status, 0, `See ${join(output, `${label}.log`)}`);
  return result.stdout;
}

function writeJson(filename, value) {
  writeFileSync(join(output, filename), JSON.stringify(value, null, 2));
}

function installConsumer(tarball) {
  writeJson('package.json', {
    private: true,
    type: 'module',
    dependencies: { demeine: `file:${tarball}` },
    devDependencies: {
      '@types/node': '24.13.2',
      typescript: '5.9.3',
      typescript7: 'npm:typescript@7.0.2'
    }
  });
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], output, 'install');
  const installed = JSON.parse(readFileSync(join(output, 'node_modules/demeine/package.json')));
  assert.equal(installed.dependencies['@types/bluebird'], '^3.5.36');
  assert.equal(installed.devDependencies?.['@types/bluebird'], undefined);
  const lock = JSON.parse(readFileSync(join(output, 'package-lock.json')));
  assert.notEqual(lock.packages['node_modules/@types/bluebird'].dev, true);
}

function checkDeclarations() {
  const source =
    "import type { Aggregate, Repository } from 'demeine';\n" + 'export type ExistingAggregate = Aggregate;\nexport type ExistingRepository = Repository;\n';
  for (const extension of ['mts', 'cts']) writeFileSync(join(output, `consumer.${extension}`), source);
  writeJson('tsconfig.json', {
    compilerOptions: {
      strict: true,
      skipLibCheck: false,
      noEmit: true,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      esModuleInterop: true,
      types: ['node'],
      typeRoots: ['./node_modules/@types']
    },
    files: ['consumer.mts', 'consumer.cts']
  });
  for (const compiler of ['typescript', 'typescript7']) {
    const files = run(process.execPath, [`node_modules/${compiler}/bin/tsc`, '-p', 'tsconfig.json', '--listFiles'], output, compiler);
    for (const file of files.trim().split('\n')) assert.ok(file.startsWith(`${output}/`), `Ancestor type leaked: ${file}`);
  }
}

const packed = JSON.parse(run('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', output], root, 'pack'));
assert.equal(packed.length, 1);
assert.ok(packed[0].files.some((file) => file.path === 'lib/repository/Partition.interfaces.d.ts'));
installConsumer(resolve(output, packed[0].filename));
checkDeclarations();
console.log('PASS: packed ESM/CJS declaration closure on TS5.9.3 and TS7.0.2; no consumer Bluebird dependency injection');
