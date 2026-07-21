# Google Apps Script TypeScript Starter

Reusable Google Workspace automation starter for teams building Google Apps Script projects in TypeScript with clean architecture, esbuild, Vitest, clasp, and GitHub Actions.

## Vision

This repository is a framework-style starter for Google Workspace automation rather than a single-product demo. It separates entrypoints, application services, domain models, infrastructure adapters, and Google-specific runtime integrations so teams can build Sheets automations, Gmail workflows, Calendar jobs, Drive jobs, Web Apps, and trigger-driven scripts without putting `SpreadsheetApp`, `GmailApp`, `CalendarApp`, or `DriveApp` inside business logic.

## Architecture

```text
Entrypoints
  -> Application Services
    -> Domain Models
      -> Ports
        -> Infrastructure Adapters
          -> Google Apps Script APIs
```

Repository layout:

```text
src/
├── application/
│   ├── ports/
│   └── services/
├── config/
├── domain/
│   ├── entities/
│   └── models/
├── entrypoints/
│   ├── sheets/
│   ├── triggers/
│   └── webapp/
├── infrastructure/
│   ├── adapters/
│   ├── http/
│   └── logging/
├── utils/
└── index.ts
```

## Supported Adapters

- Sheets adapter: create sheets, read ranges, write ranges, append rows
- Gmail adapter: send text and HTML email
- Calendar adapter: create, update, delete events
- Drive adapter: create files, update files, manage folders
- HTTP adapter: external API requests with centralized error handling
- UI adapter: spreadsheet menu and alert wiring kept out of application services

## Example Application

The starter includes `DailyReportService`, which demonstrates a reusable automation flow:

1. Time trigger or menu action enters through an entrypoint.
2. `DailyReportService` reads report rows through `SheetPort`.
3. The service formats a report and sends it through `MailPort`.
4. Runtime-specific work stays inside `SheetsAdapter` and `GmailAdapter`.

Web App support is also included through `doGet` and `doPost`. The sample `WebAppService` stores incoming payloads in Drive through `DrivePort`.

## Development Workflow

1. Install dependencies with `npm install`.
2. Copy `.clasp.json.example` to `.clasp.json` locally and set your Apps Script `scriptId`.
3. Authenticate with `npx clasp login`.
4. Set Script Properties used by the starter:
   `REPORT_RECIPIENT`, `REPORT_SHEET_NAME`, `REPORT_RANGE`, `REPORT_MENU_TITLE`, `REPORT_DRIVE_FOLDER`, `EXTERNAL_API_URL`, `EXTERNAL_API_TOKEN`, `DEFAULT_CALENDAR_ID`
5. Run validation locally:
   `npm run format`
   `npm run lint`
   `npm run typecheck`
   `npm run test`
   `npm run build`

## Deployment Workflow

The deployment path remains:

`TypeScript -> esbuild -> dist -> clasp push -> Google Apps Script`

Local commands:

- `npm run build`
- `npm run push`
- `npm run deploy:local`
- `npm run pull`

CI validates formatting, linting, type checking, tests, and the build. Deployment runs from GitHub Actions after CI succeeds on `main`.

## Extension Guide

To add a new automation use case:

1. Define a port in `src/application/ports` if the use case needs a new external dependency.
2. Implement the port in `src/infrastructure`.
3. Add an application service in `src/application/services`.
4. Wire the service in `src/config/service-container.ts`.
5. Expose it through an entrypoint in `src/entrypoints`.
6. Add Vitest unit tests using fakes or mocks instead of Apps Script globals.

Further details are in [docs/Architecture.md](./docs/Architecture.md), [docs/Adapters.md](./docs/Adapters.md), [docs/Development.md](./docs/Development.md), and [docs/Deployment.md](./docs/Deployment.md).
