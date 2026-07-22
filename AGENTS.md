# AGENTS.md

## Dev environment tips

- Use Node.js 20 or later.
- Run `npm install` after cloning the repository.
- Use `npm run build` to generate the Apps Script output in `dist/`.
- Treat `src/` as the source of truth. Do not manually edit generated files in `dist/`.
- Use `.clasp.json.example` as a template for local clasp configuration.
- Never commit `.clasp.json`, `.clasprc.json`, OAuth credentials, API keys, tokens, or production Script IDs.
- Keep the existing TypeScript, esbuild, Vitest, ESLint, Prettier, clasp, and GitHub Actions toolchain unless a change is explicitly requested.

## Architecture instructions

- This repository is an application, not a framework.
- Prefer a lightweight Google Apps Script structure over Clean Architecture or enterprise backend patterns.
- Organize code by feature, such as:
  - `orders/`
  - `inventory/`
  - `shipping/`
  - `tracking/`
  - `reports/`
  - `triggers/`
  - `webapp/`
- Keep common Google Workspace helpers in small modules under `shared/`.
- Do not reintroduce:
  - application layers
  - domain layers
  - ports and adapters
  - service containers
  - dependency injection frameworks
  - repository interfaces with only one implementation
- Do not split one feature across several architectural layers.
- Prefer readability and developer productivity over architectural purity.

## Coding instructions

- Prefer exported functions and plain modules.

```ts
export function collectOrders(): void {
  // ...
}
```

- Avoid classes such as `CollectOrdersService` unless the code genuinely requires stateful instances.
- Use interfaces or types only when they improve clarity.
- Do not create abstractions only for consistency or future possibilities.
- Keep functions focused, but do not create unnecessary wrapper functions.
- Use explicit imports and clear names.
- Keep Apps Script global entrypoints small:

  - `onOpen`
  - `onEdit`
  - `doGet`
  - `doPost`
  - time-trigger handlers

- Entrypoints should delegate to feature functions instead of containing business logic.
- Preserve existing behavior when simplifying or moving code.
- Avoid large rewrites unless explicitly requested.

## Feature structure

A feature should usually remain self-contained.

Example:

```text
src/
├── orders/
│   ├── collectOrders.ts
│   ├── cafe24Client.ts
│   ├── orderSheet.ts
│   └── types.ts
├── shared/
│   ├── sheets.ts
│   ├── gmail.ts
│   ├── drive.ts
│   ├── http.ts
│   └── config.ts
├── triggers/
├── webapp/
└── index.ts
```

Prefer this over separating the same feature into `domain`, `application`, `ports`, `adapters`, and `infrastructure`.

## Testing instructions

- Check the CI workflows in `.github/workflows/`.
- Run all validation before completing a change:

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

- Use `npm run format:write` and `npm run lint:fix` when automatic fixes are appropriate.
- Add or update tests for changed behavior.
- After moving files or changing imports, always run type checking and the full test suite.
- Do not weaken lint, type, or test rules merely to make a change pass.
- Generated Apps Script output must continue to expose required global entrypoints.

## Documentation instructions

- Update the README when commands, setup steps, directory structure, Script Properties, or deployment behavior change.
- Documentation must distinguish between:

  - currently implemented behavior
  - planned NorthFox Logistics features

- Do not describe planned features as already implemented.
- Keep documentation practical and concise.

## Git and PR instructions

- Keep commits focused on one meaningful change.
- Avoid mixing structural refactoring with unrelated feature work.
- Before committing, run:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

- PR titles should be short and action-oriented.

Example:

```text
[orders] Add Cafe24 order collection
```

- Summarize:

  - what changed
  - why it changed
  - how it was tested

- Do not commit generated credentials or environment-specific configuration.
