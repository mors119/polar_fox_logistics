# AGENTS

## Project Overview

This repository is a reusable Google Apps Script TypeScript Starter Template.

The goal is to provide a production-ready foundation for building Google Workspace automation projects using modern software engineering practices.

Supported environments:

- Google Sheets
- Gmail
- Google Calendar
- Google Drive
- Web Apps
- Time Triggers
- Event Triggers

The project uses:

- TypeScript
- ESBuild
- ESLint
- Prettier
- Vitest
- clasp
- GitHub Actions

---

# Core Development Principles

## 1. Maintain Clean Architecture

Never place business logic directly inside Google Apps Script APIs.

The dependency direction must always be:

```

Entrypoint

↓

Application

↓

Domain

↓

Infrastructure

↓

Google API / External API

```

Dependencies must point inward.

Infrastructure code must never leak into application logic.

---

# Repository Structure

```

src/

├── entrypoints/
│
├── application/
│
├── domain/
│
├── infrastructure/
│
├── config/
│
└── utils/

```

## Entrypoints

Location:

```

src/entrypoints/

```

Responsible for:

- doGet
- doPost
- onOpen
- onEdit
- time triggers

Entrypoints should only:

- receive events
- validate input
- call application services

Do not put business logic here.

---

## Application Layer

Location:

```

src/application/

```

Contains:

- Use cases
- Services
- Business workflows

Example:

```

ReportService

ShippingService

NotificationService

```

Application services must depend on interfaces (ports), not concrete implementations.

Bad:

```typescript
import { GmailApp } from '...';
```

Good:

```typescript
import { MailPort } from '../ports/mail.port';
```

---

## Domain Layer

Location:

```
src/domain/
```

Contains:

- Entities
- Business models
- Domain rules

The domain layer must not know about:

- Google Apps Script
- HTTP clients
- Storage
- External APIs

---

## Infrastructure Layer

Location:

```
src/infrastructure/
```

Contains adapters.

Examples:

```
infrastructure/

├── google/

│   ├── sheets/

│   ├── gmail/

│   ├── calendar/

│   └── drive/


└── http/
```

Infrastructure is responsible for:

- Google API communication
- External API communication
- Logging
- Persistence

---

# Adapter Rules

All external dependencies must use adapters.

Examples:

Google Sheets:

```
Application

↓

SheetRepository Port

↓

SheetsAdapter

↓

SpreadsheetApp
```

Gmail:

```
Application

↓

MailPort

↓

GmailAdapter

↓

GmailApp
```

Never call Google APIs directly from services.

---

# Configuration Rules

## No Hardcoding

Never hardcode:

- URLs
- API keys
- Spreadsheet IDs
- Calendar IDs
- Email addresses

Bad:

```typescript
fetch('https://api.example.com');
```

Good:

```typescript
ConfigService.get('API_URL');
```

Configuration sources:

- Script Properties
- Environment configuration
- Deployment secrets

---

# TypeScript Rules

Always use:

- strict mode
- explicit types
- interfaces for contracts

Avoid:

```typescript
any;
```

unless absolutely required.

Prefer:

```typescript
unknown;
```

with validation.

---

# Testing Rules

Business logic must be testable without Google Apps Script runtime.

Use:

- Vitest
- Mock adapters

Example:

```
Application Service

↓

MockSheetAdapter

↓

Test
```

Tests location:

```
tests/

├── unit/

└── integration/
```

---

# Google Apps Script Rules

## Source of Truth

The source code is:

```
src/
```

Never manually edit generated files.

Build output:

```
dist/
```

is deployment output only.

---

## clasp Rules

Local development:

```
npm run push
```

CI deployment:

```
GitHub Actions
        |
        ↓
clasp push
```

Never commit:

```
.clasp.json
```

Only use:

```
.clasp.json.example
```

---

# Build Rules

The build pipeline is:

```
TypeScript

↓

ESBuild

↓

dist

↓

clasp

↓

Google Apps Script
```

Never bypass the build process.

---

# Git Rules

Before committing:

Run:

```
npm run format:check

npm run lint

npm run typecheck

npm run test

npm run build
```

Commit messages should describe intent.

Examples:

Good:

```
feat: add Gmail notification adapter

fix: handle calendar API error
```

Bad:

```
update code
change files
```

---

# Google Workspace Extension Rules

When adding a new Google service:

Do not:

```
services/

    directly call API
```

Instead:

1. Create Port

```
application/ports/
```

2. Create Adapter

```
infrastructure/google/
```

3. Inject dependency into service

---

# Adding New Features

Feature implementation order:

1. Define domain model

2. Define application service

3. Define required ports

4. Implement infrastructure adapters

5. Add entrypoint

6. Add tests

7. Update documentation

---

# Documentation Rules

Any architectural change requires updating:

```
README.md

docs/Architecture.md

docs/Development.md
```

Public APIs require:

```
docs/API.md
```

---

# Security Rules

Never commit:

- OAuth tokens
- API keys
- credentials
- Script IDs belonging to production

Sensitive values must use:

- GitHub Secrets
- Script Properties
- Environment configuration

---

# AI Agent Rules

When modifying this repository:

1. Understand the architecture before coding.

2. Do not introduce shortcuts that bypass layers.

3. Prefer small, isolated changes.

4. Add tests for new business logic.

5. Update documentation when architecture changes.

6. Do not remove abstractions unless there is a strong reason.

7. Preserve the reusable template nature of this repository.

The goal is not only to make code work.

The goal is to maintain a reusable Google Apps Script application framework.
