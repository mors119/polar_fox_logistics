# polar_fox_logistics

Google Apps Script로 상품 및 주문 파일을 Google Drive의 공통 입력 폴더에서 읽어 Google Sheets에 적재하는 자동화 프로젝트입니다.

이 저장소는 `src/` 아래 JavaScript 파일을 그대로 `clasp push` 하는 구조입니다.

## 핵심 기능

- 헤더 구조로 상품/주문 파일을 자동 판별
- 상품 파일을 읽어 `상품마스터` 시트에 적재
- 주문 파일을 읽어 `주문`, `주문상품` 시트에 적재
- 주문 등록 시 발송대기 예약, 출고 체크 시 실제 재고 차감
- 수동 상품 검증·승인과 신규/재입고 대기작업 생성
- 입고예정·실제·정상·불량 수량 검수, 부족·초과 자동 계산
- 입고 확정 중 실행이 끊겨도 중복 반영하지 않는 자동 복구
- 로케이션 순서의 피킹지시, 카트 슬롯·담당자 자동 배정
- O/X 피킹 확인과 주문 단위 전체 출고·취소 처리
- 메인 데이터·입고 작업·피킹 작업·조회 대시보드를 별도 파일로 분리
- 파일 간 주문·상품·피킹·입고 참조를 확인하는 `🔗 교차검증` 뷰
- `재고이력`에 신규입고·재입고·주문예약·출고·출고취소 기록
- `출고후잔량`과 안전재고 기준 `재고상태` 자동 갱신
- 처리 실패 시 `오류목록`, `파일처리이력` 기록
- 성공한 입력 파일은 `success`, 실패한 파일은 `error` 폴더에 보관
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

### 실제 생성되는 운영 파일

- `01_메인데이터_수정금지`: `설정`, `상품마스터`, `주문`, `주문상품`, 이력·오류 시트
- `02_상품입고_작업`: `상품등록`, `대기작업`, `완료작업`, `오류작업`
- `03_피킹_작업`: `피킹헤더`, `피킹라인`
- `04_운영대시보드_조회용`: `📊 재고현황`, `📊 주문현황`, `📊 피킹현황`, `🔗 교차검증`, `주문(완료)`

`01`의 시스템 데이터와 `04`는 setup 실행 계정만 수정하도록 시트 보호가 설정됩니다. `01`의 `설정`만 운영자가 변경할 수 있고, 작업자는 `02`와 `03`을 사용합니다.

### 공통 폴더

- `error`
- `input`
- `success`

실행 함수: `setupSystem()`

트리거:

- `scanInputFolder()`
- `handleOrderItemCheckboxEdit()` 설치형 편집 트리거
- 설정값이 있으면 `sendConfiguredBackupEmail()`

## 공통 입력 폴더

상품과 주문 파일은 모두 `input` 폴더에 넣습니다. 스캐너가 첫 행의 필수 헤더 조합으로 파일 유형을 판별합니다.

- 상품: `상품품목코드`, `상품명`
- 주문: `주문번호`, `품목별 주문번호`, `상품품목코드`, `주문상품명`, `수량`, `수령인`, `수령인 주소`

최신 운영 파일의 `내부SKU`, `옵션명`, `기본보관위치`, `예약재고`와 최신 주문 내보내기의 `쇼핑몰번호`, `배송메시지`, `총 주문금액(KRW)`, `주문상품명(기본)`, `수령인 주소(전체)`를 자동 변환합니다. 카페24 재고 파일의 `품목코드`와 `재고수량`도 각각 상품품목코드와 가용재고로 인식합니다.

`상품마스터`의 앞 15개 컬럼은 최신 양식 순서로 표시하고 자동화용 추가 컬럼은 뒤쪽에 숨겨 보존합니다. `주문(완료)` 시트는 주문과 주문상품 데이터를 최신 21개 컬럼 형식으로 자동 조합합니다.

어느 형식에도 맞지 않거나 두 형식의 필수 헤더가 동시에 있으면 오류로 기록하고 파일을 `error` 폴더로 이동합니다.

CSV, Excel(`.xlsx`, `.xls`), Google 스프레드시트를 지원합니다. CSV 확장자는 반드시 `.csv`여야 하며 `.cvs`는 처리되지 않습니다.

## 실행 순서

1. Script Properties에 `ROOT_FOLDER_ID` 설정
2. `setupSystem()` 실행
3. 반환값의 `files.main`, `files.inbound`, `files.picking`, `files.dashboard` URL로 4개 파일 확인
4. 생성된 `input`, `success`, `error` 폴더 확인
5. 상품 또는 주문 파일을 `input`에 업로드
6. 트리거를 기다리거나 `scanInputFolder()`를 수동 실행
7. 성공 시 관련 시트에 반영되고 원본 입력 파일은 `success` 폴더로 이동
8. 실패 시 `오류목록`, `파일처리이력`에 기록되고 입력 파일은 `error` 폴더로 이동

## 수동 상품·입고 처리

1. `상품등록` 탭에 상품 기본정보를 입력
2. `재고관리 > 상품 검증`, `상품 승인` 순서로 실행
3. `대기작업`에서 실제입고일과 예정·실제·정상·불량 수량을 입력
4. `재고관리 > 입고 검수`, `입고 확정` 순서로 실행
5. 정상수량은 가용재고, 불량수량은 불량재고에 반영되며 작업은 `완료작업`으로 이동

`입고확정처리중` 상태가 남으면 행을 수정하지 말고 `confirmInbound()`를 다시 실행하세요. 반영 전·후 재고를 비교해 미반영 작업만 적용합니다.

## 피킹·패킹 처리

1. `재고관리 > 피킹지시 생성`으로 미출고 주문을 `피킹헤더`, `피킹라인`에 생성
2. 작업자는 `피킹라인`의 확인에 O 또는 X를 선택하고, X인 경우 예외사유를 입력
3. `syncPickingResults()`가 5분마다 자동 실행되며, 급하면 `피킹결과 반영` 메뉴로 수동 실행
4. 전부 O인 주문만 출고하며 X가 하나라도 있으면 주문 전체를 취소하고 예약 재고를 해제

`피킹 담당자`, `담당자별 주문수`, `피킹 반영 트리거 분`은 `설정` 시트에서 변경할 수 있습니다. `재고관리 > 운영 대시보드 갱신`으로 재고·주문·피킹 현황 화면을 한 번에 갱신할 수 있습니다.

기존 버전에서 업데이트했다면 `setupSystem()`을 다시 실행하세요. `success` 폴더와 `SUCCESS_FOLDER_ID`가 추가되며, 기존에 휴지통으로 이동한 파일은 자동 복원하지 않습니다.

## Script Properties

처음에는 아래 값만 직접 준비하면 됩니다.

- `ROOT_FOLDER_ID`: 작업 폴더와 운영 스프레드시트를 생성할 상위 Drive 폴더 ID

초기화 후에는 아래 값들이 자동으로 채워집니다.

- `OPERATIONS_SPREADSHEET_ID`
- `MAIN_SPREADSHEET_ID`
- `INBOUND_SPREADSHEET_ID`
- `PICKING_SPREADSHEET_ID`
- `DASHBOARD_SPREADSHEET_ID`
- `INPUT_FOLDER_ID`
- `SUCCESS_FOLDER_ID`
- `ERROR_FOLDER_ID`

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

- `src/Config.js`: 상품 폴더/시트/속성 키 설정
- `src/Setup.js`: 공통 입력 폴더, 운영 스프레드시트, 트리거 통합 초기화
- `src/Main.js`: 공통 입력 스캔, 파일 유형 판별, 상품 처리 흐름
- `src/CsvVaildation.js`: 상품 CSV 파싱/헤더/행 검증
- `src/Productimport.js`: 상품마스터 적재와 중복 코드 검사
- `src/InventoryService.js`: 출고후잔량, 재고상태, 재고이력 공통 처리
- `src/InboundWorkflow.js`: 수동 상품 승인, 입고 검수·확정, 중단 작업 복구
- `src/PickingWorkflow.js`: 피킹지시, O/X 결과 반영, 주문 취소, 피킹 대시보드
- `src/Dashboard.js`: 재고·주문·피킹 카드형 현황 화면과 운영 시트 UI
- `src/HistoryAndError.js`: 이력/오류 기록과 공통 시트 접근

- `src/Order_Config.js`: 주문 폴더/시트/헤더 설정
- `src/Order_Main.js`: 주문 처리 메인 흐름
- `src/Order_CsvParser.js`: 주문 CSV 파싱
- `src/Order_Validator.js`: 주문 헤더/행 검증
- `src/Order_DuplicateChecker.js`: 주문 파일/품목번호 중복 검사
- `src/Order_SheetRepository.js`: 주문/주문상품 시트 적재와 롤백
- `src/Order_ErrorService.js`: 주문 이력/오류 기록
- `src/Order_EditService.js`: 주문상품 체크박스 편집과 발송대기 반영

## 문서

- [개발 문서](docs/Development.md)
- [아키텍처](docs/Architecture.md)
- [배포 문서](docs/Deployment.md)
- [운영 준비 문서](docs/Operations.md)
