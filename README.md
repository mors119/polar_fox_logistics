# NorthFox Logistics

북극여우 스토어의 주문, 출고, 재고, 배송 운영을 Google Workspace와 외부 API 기반으로 자동화하기 위한 Google Apps Script 프로젝트입니다.

이 저장소는 **NorthFox Logistics**를 실제로 확장해 가기 위한 코드베이스입니다.  
현재는 공통 구조와 샘플 자동화 기능이 포함되어 있고, 이후 Cafe24 주문 수집, 재고 차감, 송장 발급, 배송 추적, 운영 대시보드 기능을 이 구조 위에 올리는 것을 목표로 합니다.

## 프로젝트 목표

- 주문 데이터를 자동 수집하고 표준화합니다.
- Google Sheets를 운영 중심 데이터 저장소로 사용합니다.
- 재고 변동을 자동 반영할 수 있는 구조를 만듭니다.
- 출고 일정과 배송 상태를 Google Workspace 안에서 관리합니다.
- 운영 지표와 주간 보고를 자동화합니다.

## 현재 구현된 기능

현재 코드 기준으로 실제 포함된 기능은 아래와 같습니다.

- 시트 데이터를 읽어 Gmail로 리포트를 보내는 기능
- 시트 데이터를 Drive JSON 파일로 저장하는 스냅샷 기능
- Web App POST payload를 Drive에 저장하는 기능
- `onOpen`, `onEdit`, 시간 기반 트리거 진입점
- 스프레드시트 메뉴 액션 등록 구조

즉, 문서상 최종 목표는 물류 자동화 전체 흐름이지만, 현재 구현 상태는 그 흐름을 확장하기 위한 기반 플랫폼에 가깝습니다.

## 목표 업무 흐름

```text
Cafe24 주문
  -> 주문 데이터 수집
    -> Google Sheets 주문 기록
      -> 재고 자동 차감
        -> 송장 발급
          -> Google Calendar 출고 일정 등록
            -> 배송 조회
              -> 배송 상태 갱신
                -> 대시보드 및 주간 보고서
```

## 기술 구조

```text
Entrypoints
  -> Application Services
    -> Domain Models
      -> Ports
        -> Infrastructure Adapters
          -> Google Workspace APIs
          -> External APIs
```

주요 디렉터리:

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

## 실행 전 준비물

아래 조건이 필요합니다.

- Node.js 20 이상
- npm
- Google 계정
- Apps Script 프로젝트 1개
- `clasp`를 사용할 수 있는 계정 권한
- 필요하면 GitHub Actions 배포 권한

## 빠른 시작

처음 실행하는 사람은 아래 순서대로 진행하면 됩니다.

### 1. 저장소 클론

```bash
git clone <repository-url>
cd polar_fox
```

### 2. 의존성 설치

```bash
npm install
```

CI와 같은 방식으로 깨끗하게 설치하려면:

```bash
npm ci
```

### 3. Apps Script 프로젝트 준비

Google Apps Script에서 새 프로젝트를 만들거나 기존 프로젝트를 준비합니다.

Script ID는 아래에서 확인합니다.

```text
Apps Script Editor
-> Project Settings
-> Script ID
```

주의:

- Script ID와 Deployment ID는 다릅니다.
- Spreadsheet ID와도 다릅니다.
- Web App URL을 넣으면 안 됩니다.

### 4. 로컬 `.clasp.json` 생성

예시 파일을 복사합니다.

```bash
cp .clasp.json.example .clasp.json
```

그리고 `.clasp.json`을 열어 실제 Script ID를 넣습니다.

예시:

```json
{
  "scriptId": "YOUR_APPS_SCRIPT_ID",
  "rootDir": "dist"
}
```

중요:

- `.clasp.json`은 로컬 파일입니다.
- 실제 Script ID가 들어가므로 커밋하면 안 됩니다.
- 저장소에는 `.clasp.json.example`만 남겨둡니다.

### 5. Apps Script API 활성화

`clasp push`를 사용하려면 **Google Apps Script API**가 활성화되어 있어야 합니다.

확인 방법:

```text
Apps Script Editor
-> Settings / 사용자 설정
-> Google Apps Script API 활성화
```

주의:

- 이 설정은 계정 단위입니다.
- 브라우저에 Google 계정이 여러 개 로그인되어 있으면 다른 계정에 켜는 실수가 자주 납니다.
- `npx clasp login`한 계정과 같은 계정에 활성화해야 합니다.

### 6. clasp 로그인

```bash
npx clasp login
```

성공하면 보통 아래 파일이 생성됩니다.

```text
~/.clasprc.json
```

이 파일에는 인증 정보가 들어 있으므로 외부에 공유하면 안 됩니다.

### 7. Script Properties 설정

대상 Apps Script 프로젝트에서 Script Properties를 설정합니다.

현재 코드 기준으로 사용되는 주요 값:

```text
REPORT_RECIPIENT
REPORT_SHEET_NAME
REPORT_RANGE
REPORT_MENU_TITLE
REPORT_DRIVE_FOLDER
REPORT_SNAPSHOT_FOLDER
EXTERNAL_API_URL
EXTERNAL_API_TOKEN
DEFAULT_CALENDAR_ID
```

권장 예시:

```text
REPORT_RECIPIENT=ops@example.com
REPORT_SHEET_NAME=Report
REPORT_RANGE=A1:C10
REPORT_MENU_TITLE=NorthFox Logistics
REPORT_DRIVE_FOLDER=NorthFox Payloads
REPORT_SNAPSHOT_FOLDER=NorthFox Snapshots
EXTERNAL_API_URL=https://api.example.com
EXTERNAL_API_TOKEN=replace-me
DEFAULT_CALENDAR_ID=primary
```

향후 물류 기능 확장 시 아래 설정이 추가될 수 있습니다.

```text
CAFE24_API_URL
CAFE24_ACCESS_TOKEN
SHIPPING_API_URL
SHIPPING_API_TOKEN
```

### 8. 로컬 검증 실행

아래 명령으로 기본 검증을 돌립니다.

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

각 명령의 의미:

- `npm run format`: Prettier 규칙 검사
- `npm run lint`: ESLint 검사
- `npm run typecheck`: TypeScript 타입 검사
- `npm run test`: Vitest 테스트 실행
- `npm run build`: `dist/Code.js` 생성

포맷 수정까지 자동 적용하려면:

```bash
npm run format:write
```

린트 자동 수정까지 하려면:

```bash
npm run lint:fix
```

### 9. Apps Script로 반영

빌드 후 Apps Script로 코드를 올리려면:

```bash
npm run push
```

이 명령은 내부적으로 아래 흐름으로 동작합니다.

```text
npm run build
-> clasp push
```

로컬 개발용 간단 명령도 있습니다.

```bash
npm run deploy:local
```

### 10. 스프레드시트에서 동작 확인

이 프로젝트가 스프레드시트에 바인딩되어 있거나 해당 프로젝트가 시트와 연결되어 있다면:

1. 시트를 새로 엽니다.
2. `onOpen`이 실행되며 메뉴가 설치되는지 확인합니다.
3. 메뉴에서 `Run Daily Report` 또는 `Export Report Snapshot`를 실행합니다.
4. Gmail 또는 Drive 결과가 생성되는지 확인합니다.

## 명령어 정리

자주 쓰는 명령:

- `npm run format`
- `npm run format:write`
- `npm run lint`
- `npm run lint:fix`
- `npm run typecheck`
- `npm run test`
- `npm run test:watch`
- `npm run build`
- `npm run push`
- `npm run deploy:local`
- `npm run pull`

### `npm run pull`에 대한 주의

```bash
npm run pull
```

이 명령은 Apps Script 원격 코드를 가져오지만, 원래 TypeScript 소스를 복구해 주지는 않습니다.

이 프로젝트의 실제 소스 기준은:

```text
src/
```

`clasp pull`로 가져오는 것은 배포 산출물에 더 가깝기 때문에, 소스 수정 기준은 항상 로컬 `src/`를 우선해야 합니다.

## 빌드와 배포 구조

빌드 흐름:

```text
TypeScript
  -> esbuild
    -> dist
      -> clasp push
        -> Google Apps Script
```

중요:

- `src/`가 소스 오브 트루스입니다.
- `dist/`는 생성 산출물입니다.
- `dist/` 내부 파일은 수동 수정하지 않는 것이 원칙입니다.

## Google Sheets 구성 제안

NorthFox Logistics를 실제 운영용으로 확장할 때는 아래 시트 구성을 권장합니다.

```text
NorthFox Logistics Spreadsheet

├── Config
├── 주문관리
├── 입고관리
├── 출고관리
├── 재고관리
├── 배송조회
└── 대시보드
```

설정값은 코드 하드코딩 대신 Script Properties 또는 `Config` 시트 중심으로 관리하는 것이 좋습니다.

## 팀 작업 방식

여러 사람이 동시에 작업할 때는 아래 원칙을 권장합니다.

- 비즈니스 로직은 `src/application/services`에 둡니다.
- 외부 시스템 연동은 먼저 포트로 추상화합니다.
- 메뉴 실행 기능은 `src/config/workspace-actions.ts`에 등록합니다.
- 공용 진입점 파일 하나에 로직을 계속 몰아넣지 않습니다.
- 시트 구조를 바꾸면 문서와 테스트도 같이 수정합니다.

현재 메뉴 액션 레지스트리 구조를 사용하면 기능 추가 시 `src/index.ts` 전체를 계속 갈아엎는 문제를 줄일 수 있습니다.

## GitHub Actions 배포

공유 배포는 GitHub Actions 기준으로 운영하는 것을 권장합니다.

CI에서 최소 확인해야 할 명령:

```bash
npm ci
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
```

배포 시 필요한 GitHub Secrets:

```text
CLASP_CREDENTIALS
CLASP_SCRIPT_ID
```

### `CLASP_CREDENTIALS`

아래 파일의 전체 내용을 GitHub Secret으로 저장합니다.

```text
~/.clasprc.json
```

생성은 로컬에서:

```bash
npx clasp login
cat ~/.clasprc.json
```

주의:

- 절대 저장소에 커밋하면 안 됩니다.
- CI 로그에 그대로 출력하면 안 됩니다.

### `CLASP_SCRIPT_ID`

배포할 Apps Script 프로젝트의 Script ID를 넣습니다.

넣으면 안 되는 값:

- Deployment ID
- Spreadsheet ID
- Google Cloud Project ID
- Web App URL

## 문제 해결

### `User has not enabled the Apps Script API`

가장 흔한 원인:

- Apps Script API가 다른 Google 계정에만 켜져 있음
- `clasp login`한 계정과 API를 켠 계정이 다름

해결 순서:

1. 현재 `clasp`가 어떤 계정으로 로그인되었는지 확인합니다.
2. 같은 계정에서 Apps Script API를 활성화합니다.
3. 몇 분 기다린 뒤 다시 시도합니다.
4. 계속 실패하면 다시 로그인합니다.

```bash
npx clasp logout
rm -f ~/.clasprc.json
npx clasp login
```

### 로컬에서는 되는데 GitHub Actions에서 실패

대부분 로컬 인증 정보와 CI 인증 정보가 다른 경우입니다.

확인할 것:

- `CLASP_CREDENTIALS`가 최신인지
- `CLASP_SCRIPT_ID`가 올바른 Script ID인지
- 배포 계정에 프로젝트 수정 권한이 있는지

### 메뉴가 보이지 않음

확인할 것:

- `onOpen`이 배포된 최신 코드인지
- 스프레드시트를 새로고침했는지
- 해당 Apps Script 프로젝트가 실제 스프레드시트와 연결되어 있는지

### 메일 또는 Drive 결과가 생성되지 않음

확인할 것:

- `REPORT_RECIPIENT`, `REPORT_DRIVE_FOLDER`, `REPORT_SNAPSHOT_FOLDER` 값이 설정되어 있는지
- 실행 계정이 Gmail/Drive 접근 권한을 가지고 있는지
- Apps Script 실행 로그에 오류가 없는지

## 보안 주의사항

커밋하면 안 되는 항목:

- `.clasp.json`
- `~/.clasprc.json`
- API 토큰
- 운영 Script ID
- 외부 서비스 인증 정보

권장 방식:

- 배포 자격증명은 GitHub Secrets로 관리
- 런타임 설정은 Script Properties로 관리
- 운영 계정과 테스트 계정을 분리
- 민감한 쓰기 동작은 운영 반영 전에 테스트 환경에서 검증

## 문서

상세 문서는 아래를 참고하면 됩니다.

- [아키텍처](./docs/Architecture.md)
- [어댑터](./docs/ADAPTERS.md)
- [개발 문서](./docs/Development.md)
- [배포 문서](./docs/Deployment.md)
- [기여 가이드](./docs/Contributing.md)
