# Contributing

## Principles

- keep business logic inside `src/application`
- add or update ports before adding direct runtime calls
- prefer reusable abstractions over project-specific shortcuts
- add tests for new application services
- update docs when architecture or workflow changes

## Pull Request Checklist

- `npm run format`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
