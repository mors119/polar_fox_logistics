# Architecture

## Goal

This starter provides a clean architecture baseline for Google Apps Script projects that need to work across multiple Google Workspace surfaces without hard-coding those APIs into business logic.

## Layers

### Entrypoints

Located in `src/entrypoints/`.

- `webapp/`: `doGet` and `doPost`
- `triggers/`: time-based and installable/simple triggers
- `sheets/`: spreadsheet menu wiring

Entrypoints translate runtime events into application service calls.

### Application

Located in `src/application/`.

- `services/`: use-case orchestration
- `ports/`: contracts for external dependencies

Application services never call `SpreadsheetApp`, `GmailApp`, `DriveApp`, `CalendarApp`, or `UrlFetchApp` directly.

### Domain

Located in `src/domain/`.

Domain entities and models hold application data structures that are independent of the Google runtime.

### Infrastructure

Located in `src/infrastructure/`.

Infrastructure implements application ports using Google Apps Script APIs and related helpers.

## Dependency Direction

```text
Entrypoints -> Application -> Domain
                         -> Ports -> Infrastructure -> Google APIs
```

Dependencies point inward. Ports live with the application, adapters live with infrastructure.

## Composition

`src/config/service-container.ts` is the composition root. It assembles:

- configuration providers
- adapters
- logging
- application services

This keeps object wiring in one place and keeps entrypoints thin.
