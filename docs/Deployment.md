# Deployment

## Workflow

The repository keeps the standard Apps Script deployment flow:

`TypeScript -> esbuild -> dist -> clasp push -> Google Apps Script`

`esbuild` writes `dist/Code.js` and copies `appsscript.json` into `dist/`.

## Local Deployment

- `npm run build`
- `npm run push`
- `npm run deploy:local`

`deploy:local` is a convenience alias for local development. GitHub Actions remains the canonical shared deployment path for the template.

## GitHub Actions

CI validates:

1. dependency installation
2. formatting
3. linting
4. type checking
5. unit tests
6. build output

Deployment:

1. runs after CI succeeds on `main`
2. rebuilds the project
3. writes `~/.clasprc.json` from `CLASP_CREDENTIALS`
4. generates `.clasp.json` from `CLASP_SCRIPT_ID`
5. runs `clasp push --force`

## Required Secrets

- `CLASP_CREDENTIALS`
- `CLASP_SCRIPT_ID`
