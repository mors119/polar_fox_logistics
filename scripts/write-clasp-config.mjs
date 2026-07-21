import { writeFile } from 'node:fs/promises';

const scriptId = process.env.CLASP_SCRIPT_ID;

if (!scriptId) {
  throw new Error('CLASP_SCRIPT_ID is required to generate .clasp.json');
}

const config = {
  scriptId,
  rootDir: 'dist',
};

await writeFile('.clasp.json', `${JSON.stringify(config, null, 2)}\n`, 'utf8');
