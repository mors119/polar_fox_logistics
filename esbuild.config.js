import { build } from 'esbuild';
import { cp, mkdir } from 'node:fs/promises';

const outputDirectory = 'dist';

await build({
  entryPoints: ['src/index.ts'],
  outfile: `${outputDirectory}/Code.js`,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: false,
  legalComments: 'none',
  charset: 'utf8',
  logLevel: 'info',
});

await mkdir(outputDirectory, { recursive: true });
await cp('appsscript.json', `${outputDirectory}/appsscript.json`);
