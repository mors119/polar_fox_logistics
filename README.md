# polar_fox_logistics

Google Apps Script로 상품 CSV와 주문 CSV를 Google Drive의 입력 폴더에서 읽어 Google Sheets에 적재하는 자동화 프로젝트입니다.

이 저장소는 `src/` 아래 JavaScript 파일을 그대로 `clasp push` 하는 구조입니다.

## 핵심 기능

- 상품 CSV를 읽어 `상품마스터` 시트에 적재
- 주문 CSV를 읽어 `주문`, `주문상품` 시트에 적재
- 처리 실패 시 `오류목록`, `파일처리이력` 기록
- 처리한 입력 파일은 시트 기록 후 휴지통으로 정리
- 시간 기반 트리거로 자동 실행

## 실행 방식

- 이 프로젝트는 standalone Apps Script 프로젝트에서도 실행할 수 있습니다.
- 먼저 Script Properties에 `ROOT_FOLDER_ID`를 넣어야 합니다.
- 초기화 함수가 이 상위 폴더 아래에 입력 폴더와 운영 스프레드시트를 자동 생성합니다.

## 시작 전 준비물

1. Google Drive에 상위 작업 폴더 하나 생성
2. 해당 폴더 ID 복사
3. Apps Script의 Script Properties에 아래 값 저장

```text
ROOT_FOLDER_ID=상위_작업_폴더_ID
```

## 자동으로 생성되는 것

초기화 함수를 실행하면 `ROOT_FOLDER_ID` 아래에 아래 항목이 자동 생성되거나 재사용됩니다.

### 공통

- 운영 스프레드시트 1개
- `오류목록`
- `파일처리이력`

### 상품 CSV용

실행 함수: `setupSystem()`

생성/사용 폴더:

- `csv_input`

생성/사용 시트:

- `상품마스터`

트리거:

- `scanCsvInputFolder()`를 5분마다 실행

### 주문 CSV용

실행 함수: `setupOrderCsvSystem()`

생성/사용 폴더:

- `order_csv_input`

생성/사용 시트:

- `주문`
- `주문상품`

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

1. Script Properties에 `ROOT_FOLDER_ID` 설정
2. `setupSystem()` 실행
3. 반환된 `spreadsheetUrl` 또는 `OPERATIONS_SPREADSHEET_ID`로 운영 스프레드시트 확인
4. 생성된 `csv_input` 폴더에 `.csv` 파일 업로드
5. 트리거를 기다리거나 `scanCsvInputFolder()` 수동 실행
6. 성공 시 `상품마스터`에 적재
7. 실패 시 `오류목록`, `파일처리이력`에 기록
8. 성공/실패와 관계없이 입력 파일은 휴지통으로 정리

### 주문 CSV

1. Script Properties에 `ROOT_FOLDER_ID` 설정
2. `setupOrderCsvSystem()` 실행
3. 반환된 `spreadsheetUrl` 또는 `OPERATIONS_SPREADSHEET_ID`로 운영 스프레드시트 확인
4. 생성된 `order_csv_input` 폴더에 `.csv` 파일 업로드
5. 트리거를 기다리거나 `scanOrderFolder()` 수동 실행
6. 성공 시 `주문`, `주문상품` 시트에 적재
7. 실패 시 `오류목록`, `파일처리이력`에 기록
8. 성공/실패와 관계없이 입력 파일은 휴지통으로 정리

## Script Properties

처음에는 아래 값만 직접 준비하면 됩니다.

- `ROOT_FOLDER_ID`: 작업 폴더와 운영 스프레드시트를 생성할 상위 Drive 폴더 ID

초기화 후에는 아래 값들이 자동으로 채워집니다.

- `OPERATIONS_SPREADSHEET_ID`
- `CSV_INPUT_FOLDER_ID`
- `ORDER_CSV_INPUT_FOLDER_ID`

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

- `src/Config.js`: 상품 폴더/시트/속성 키 설정
- `src/Setup.js`: 상품 입력 폴더/운영 스프레드시트/트리거 초기화
- `src/Main.js`: 상품 CSV 처리 메인 흐름
- `src/CsvVaildation.js`: 상품 CSV 파싱/헤더/행 검증
- `src/Productimport.js`: 상품마스터 적재와 중복 코드 검사
- `src/HistoryAndError.js`: 이력/오류 기록과 공통 시트 접근

### 주문 흐름

- `src/Order_Config.js`: 주문 폴더/시트/헤더 설정
- `src/Order_Setup.js`: 주문 입력 폴더/시트/트리거 초기화
- `src/Order_Main.js`: 주문 CSV 처리 메인 흐름
- `src/Order_CsvParser.js`: 주문 CSV 파싱
- `src/Order_Validator.js`: 주문 헤더/행 검증
- `src/Order_DuplicateChecker.js`: 주문 파일/품목번호 중복 검사
- `src/Order_SheetRepository.js`: 주문/주문상품 시트 적재와 롤백
- `src/Order_ErrorService.js`: 주문 이력/오류 기록
- `src/Order_DriveService.js`: 주문 입력 폴더 접근과 파일 정리

## 문서

- [개발 문서](docs/Development.md)
- [아키텍처](docs/Architecture.md)
- [배포 문서](docs/Deployment.md)
- [운영 준비 문서](docs/Operations.md)
