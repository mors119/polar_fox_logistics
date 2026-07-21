# Adapters

## Sheets Adapter

File: `src/infrastructure/adapters/sheets/sheets.adapter.ts`

Responsibilities:

- create sheets
- read values from A1 ranges
- write values to A1 ranges
- append rows

The adapter is the only place where `SpreadsheetApp` is used for sheet operations.

## Gmail Adapter

File: `src/infrastructure/adapters/gmail/gmail.adapter.ts`

Responsibilities:

- send text email
- send HTML email

The application layer works only with `MailPort`.

## Calendar Adapter

File: `src/infrastructure/adapters/calendar/calendar.adapter.ts`

Responsibilities:

- create events
- update events
- delete events

The application layer works only with `CalendarPort`.

## Drive Adapter

File: `src/infrastructure/adapters/drive/drive.adapter.ts`

Responsibilities:

- ensure folders exist
- create files
- upload file content

The web app example uses this adapter through `DrivePort`.

## HTTP Adapter

File: `src/infrastructure/http/apps-script-http.adapter.ts`

Responsibilities:

- external HTTP requests
- JSON parsing
- non-2xx error handling

HTTP configuration belongs in `ConfigService`, not in application services.

## UI Adapter

File: `src/infrastructure/adapters/ui/apps-script-ui.adapter.ts`

Responsibilities:

- create spreadsheet menus
- show alerts

This keeps menu and alert behavior out of application services.
