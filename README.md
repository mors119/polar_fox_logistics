# polar_fox_logistics

Google Apps Script로 상품 CSV와 주문 CSV를 Google Drive 폴더에서 읽어 Google Sheets에 적재하는 자동화 프로젝트입니다.

이 저장소는 TypeScript 빌드 템플릿이 아니라, `src/` 아래 JavaScript 파일을 그대로 `clasp push` 하는 구조입니다.

## 핵심 기능

- 상품 CSV를 읽어 `상품마스터` 시트에 적재
- 주문 CSV를 읽어 `주문`, `주문상품` 시트에 적재
- 처리 실패 시 `오류목록`, `파일처리이력` 기록
- 처리 완료 파일과 오류 파일을 각각 다른 Drive 폴더로 이동
- 시간 기반 트리거로 자동 실행

## 반드시 알아야 할 전제

- 이 프로젝트는 **Google Sheets 바인드(bound) Apps Script** 기준으로 작성되어 있습니다.
- `setupSystem()`과 `setupOrderCsvSystem()`은 `SpreadsheetApp.getActiveSpreadsheet()`를 사용하므로,
  반드시 **스프레드시트에 연결된 Apps Script 프로젝트**에서 실행해야 합니다.
- standalone Apps Script 프로젝트에서 실행하면 `getActiveSpreadsheet()`가 `null`이라 실패합니다.

## 준비 폴더와 시트

초기화 함수를 실행하면 아래 폴더와 시트가 준비됩니다.

### 상품 CSV용

실행 함수: `setupSystem()`

생성/사용 폴더:

- `csv_input`
- `csv_processed`
- `csv_error`

생성/사용 시트:

- `상품마스터`
- `오류목록`
- `파일처리이력`

트리거:

- `scanCsvInputFolder()`를 5분마다 실행

### 주문 CSV용

실행 함수: `setupOrderCsvSystem()`

생성/사용 폴더:

- `order_csv_input`
- `order_csv_processed`
- `order_csv_error`

생성/사용 시트:

- `주문`
- `주문상품`
- `오류목록`
- `파일처리이력`

트리거:

- `scanOrderFolder()`를 5분마다 실행

## 중요한 폴더 구분

상품과 주문은 입력 폴더가 다릅니다.

- 상품 CSV는 `csv_input` 폴더에 넣어야 합니다.
- 주문 CSV는 `order_csv_input` 폴더에 넣어야 합니다.

예를 들어 `sample_order.csv`를 `csv_input`에 넣으면 주문 로직은 처리하지 않습니다.

또한 확장자는 반드시 `.csv`여야 합니다. `.cvs`는 처리되지 않습니다.

## 실행 순서

### 상품 CSV

1. `setupSystem()` 실행
2. 생성된 `csv_input` 폴더에 `.csv` 파일 업로드
3. 트리거를 기다리거나 `scanCsvInputFolder()` 수동 실행
4. 성공 시 `상품마스터`에 적재 후 `csv_processed` 이동
5. 실패 시 `오류목록`, `파일처리이력` 기록 후 `csv_error` 이동

### 주문 CSV

1. `setupOrderCsvSystem()` 실행
2. 생성된 `order_csv_input` 폴더에 `.csv` 파일 업로드
3. 트리거를 기다리거나 `scanOrderFolder()` 수동 실행
4. 성공 시 `주문`, `주문상품` 시트에 적재 후 `order_csv_processed` 이동
5. 실패 시 `오류목록`, `파일처리이력` 기록 후 `order_csv_error` 이동

## 로컬 개발

### 설치

```bash
npm install
```

### 주요 명령

```bash
npm run format
npm run format:write
npm run lint
npm run lint:fix
npm run pull
npm run push
```

## clasp 설정

`.clasp.json.example`을 참고해 `.clasp.json`을 만듭니다.

예시:

```json
{
  "scriptId": "YOUR_APPS_SCRIPT_ID",
  "rootDir": "src"
}
```

로그인:

```bash
npx clasp login
```

반영:

```bash
npm run push
```

## 파일 구조

### 상품 흐름

- `src/Config.js`: 상품 폴더/시트/헤더 설정
- `src/Setup.js`: 상품 폴더/시트/트리거 초기화
- `src/Main.js`: 상품 CSV 처리 메인 흐름
- `src/CsvVaildation.js`: 상품 CSV 파싱/헤더/행 검증
- `src/Productimport.js`: 상품마스터 적재와 중복 코드 검사
- `src/HistoryAndError.js`: 이력/오류 기록과 공통 시트 접근

### 주문 흐름

- `src/Order_Config.js`: 주문 폴더/시트/헤더 설정
- `src/Order_Setup.js`: 주문 폴더/시트/트리거 초기화
- `src/Order_Main.js`: 주문 CSV 처리 메인 흐름
- `src/Order_CsvParser.js`: 주문 CSV 파싱
- `src/Order_Validator.js`: 주문 헤더/행 검증
- `src/Order_DuplicateChecker.js`: 주문 파일/품목번호 중복 검사
- `src/Order_SheetRepository.js`: 주문/주문상품 시트 적재와 롤백
- `src/Order_ErrorService.js`: 주문 이력/오류 기록
- `src/Order_DriveService.js`: 주문 파일 이동과 입력 폴더 접근

## 문서

- [개발 문서](docs/Development.md)
- [아키텍처](docs/Architecture.md)
- [배포 문서](docs/Deployment.md)
- [운영 준비 문서](docs/Operations.md)
