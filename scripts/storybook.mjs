import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const [profile = 'public', command = 'dev', ...args] = process.argv.slice(2);
if (!['public', 'test'].includes(profile)) {
  throw new Error(`Unknown Storybook profile: ${profile}`);
}
if (!['dev', 'build'].includes(command)) {
  throw new Error(`Unsupported Storybook command: ${command}`);
}

const require = createRequire(import.meta.url);
const packagePath = require.resolve('storybook/package.json');
const { bin } = JSON.parse(readFileSync(packagePath, 'utf8'));
const executable = resolve(
  dirname(packagePath),
  typeof bin === 'string' ? bin : bin.storybook
);
const hasOutputDirectory = args.some(
  (arg) =>
    arg === '-o' || arg === '--output-dir' || arg.startsWith('--output-dir=')
);
if (command === 'build' && profile !== 'public' && !hasOutputDirectory) {
  args.push('--output-dir', `storybook-${profile}-static`);
}

const child = spawn(process.execPath, [executable, command, ...args], {
  cwd: resolve(import.meta.dirname, '..'),
  env: { ...process.env, CAROUSEL_STORYBOOK_PROFILE: profile },
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
child.on('error', (error) => {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);
});
