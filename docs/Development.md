# Development

## Local Setup

1. Install dependencies with `npm install`.
2. Copy `.clasp.json.example` to `.clasp.json`.
3. Authenticate with `npx clasp login`.
4. Configure required Script Properties in the target Apps Script project.

## Commands

- `npm run format`
- `npm run format:write`
- `npm run lint`
- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run push`
- `npm run deploy:local`
- `npm run pull`

## Testing Strategy

Vitest tests focus on the application layer. Adapters that require Apps Script globals should be tested through mocks, fakes, or higher-level integration checks rather than direct unit tests in Node.

## Extension Pattern

When adding a new use case:

1. Add or reuse an application port.
2. Implement an infrastructure adapter for that port.
3. Add a service that depends on ports, not runtime APIs.
4. Add or update an entrypoint.
5. Add Vitest tests with fake ports.
