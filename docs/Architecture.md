# 아키텍처

## 코드 읽는 순서

전체 파일을 처음부터 읽기보다 아래 순서로 보면 업무 흐름을 빠르게 파악할 수 있습니다.

1. `Config.js`, `Order_Config.js`: 폴더·시트·헤더·상태값
2. `Main.js`: 공통 입력 폴더 스캔과 상품/주문 분기
3. `Order_Main.js`: 주문 파일 한 건의 전체 처리 순서
4. `InboundWorkflow.js`, `PickingWorkflow.js`: 입고와 출고 업무 흐름
5. `InventoryService.js`: 재고 계산과 이력
6. `Setup.js`: 최초 설치, 시트 구성, 트리거
7. `Dashboard.js`: 운영 화면 렌더링과 스타일

외부에서 직접 실행하는 함수에는 밑줄이 없고, 내부 구현 함수는 이름 끝에 `_`를 붙입니다. 예를 들어 `createPickingInstruction()`은 메뉴·트리거에서 실행할 수 있고 `buildPickingStockPlan_()`은 내부 계산 전용입니다.

## 기능별 수정 위치

| 변경하려는 내용          | 먼저 볼 파일          | 함께 확인할 파일                                   |
| ------------------------ | --------------------- | -------------------------------------------------- |
| 입력 파일 종류·헤더 판별 | `Main.js`             | `CsvValidation.js`, `Order_CsvParser.js`           |
| 상품 데이터 검증·적재    | `CsvValidation.js`    | `Productimport.js`, `Config.js`                    |
| 주문 검증·적재           | `Order_Validator.js`  | `Order_SheetRepository.js`, `Order_Main.js`        |
| 재고 계산·이력           | `InventoryService.js` | `Order_SheetRepository.js`, `Order_EditService.js` |
| 상품등록·입고            | `InboundWorkflow.js`  | `Config.js`, `Setup.js`                            |
| 피킹·취소·출고           | `PickingWorkflow.js`  | `Order_EditService.js`, `Order_Config.js`          |
| 시트·폴더·트리거         | `Setup.js`            | `Config.js`                                        |
| 대시보드 표시            | `Dashboard.js`        | `PickingWorkflow.js`                               |

업무 규칙을 바꿀 때는 같은 이름의 `scripts/*.test.mjs` 테스트를 함께 확인합니다. Apps Script API 호출은 테스트하기 어려우므로 계산·판별 로직은 가능한 한 부작용 없는 작은 내부 함수로 유지합니다.

## 구조 요약

이 프로젝트는 계층형 프레임워크가 아니라, Google Apps Script 전역 함수 파일을 역할별로 분리한 구조입니다.

공통 입력 판별 뒤에 두 개의 처리 흐름으로 나뉩니다.

- 공통 입력 파일 판별
- 상품 CSV 처리
- 주문 CSV 처리

공통 진입 흐름:

`scanInputFolder() -> routeInputFile_() -> 헤더 판별 -> 상품 또는 주문 처리`

## 운영 파일 경계

- `admin`: 설정, 시스템 원본, 재고·주문 이력, 대시보드를 보관하는 관리자용 파일이다.
- `worker`: 상품 등록·입고 검수와 피킹 입력을 위한 업무인원용 파일이다.

모든 시트 접근은 `getSheet_()`에서 시트명을 파일 그룹으로 라우팅한다. `setupSystem()`은 2개의 Google Sheets 파일을 생성·재사용하고, 기존 통합 또는 4파일 구조의 값을 최초 1회 복사한다. 기존 파일은 삭제하지 않는다.

## 상품 CSV 처리 구조

- `src/Setup.js`: 폴더, 시트, 트리거 준비
- `src/Main.js`: 파일 순회와 메인 제어
- `src/CsvValidation.js`: CSV 파싱, 헤더 검사, 행 검사
- `src/Productimport.js`: 상품마스터 시트 중복 검사와 적재
- `src/InventoryService.js`: 재고 지표 계산과 변동 이력 기록
- `src/InboundWorkflow.js`: 상품 승인, 입고 검수·확정, 멱등적 중단 복구
- `src/PickingWorkflow.js`: 피킹 지시·배정, O/X 결과, 주문 단위 출고·취소, 대시보드
- `src/Dashboard.js`: 최신 운영 양식 기반 재고·주문·피킹 UI와 시트 스타일

상품마스터 스키마 변경은 열 위치가 아니라 헤더 별칭을 기준으로 값을 재배치합니다. 주문·주문상품 원본 구조는 유지하고 `주문(완료)` 투영 시트에서 최신 단일 테이블 형식으로 제공합니다.

- `src/HistoryAndError.js`: 오류/이력 기록, 공통 시트 접근

실행 흐름:

`processCsvFile_() -> validate -> duplicate check -> import -> move file -> history`

## 주문 CSV 처리 구조

- `src/Setup.js`: 상품/주문 폴더, 시트, 트리거 통합 준비
- `src/Order_Main.js`: 주문 파일 순회와 메인 제어
- `src/Order_CsvParser.js`: 주문 CSV 파싱
- `src/Order_Validator.js`: 헤더/행 검증
- `src/Order_DuplicateChecker.js`: 파일 및 품목번호 중복 검사
- `src/Order_SheetRepository.js`: 주문/주문상품 적재, 롤백
- `src/Order_ErrorService.js`: 주문 오류/이력 기록

실행 흐름:

`processOrderFile() -> validate -> duplicate check -> import orders -> import order items -> move file -> history`

재고 흐름:

`신규/재입고 -> 가용재고 증가 -> 주문등록 -> 발송대기 증가 -> 출고완료 -> 가용재고·발송대기 감소`

수동 입고 흐름:

`상품등록 -> 검증 -> 승인 -> 대기작업 -> 입고검수완료 -> 입고확정처리중 -> 완료작업`

`입고확정처리중`에서는 작업 ID와 반영 전·후 수량을 기록한다. 재실행 시 현재 수량이 반영 전이면 반영하고, 반영 후면 이력·완료 처리만 끝낸다. 둘 다 아니면 `오류작업`으로 분리한다.

피킹 흐름:

`출고대기 주문 -> 피킹헤더/피킹라인 -> O/X 확인 -> 주문 전체 출고 또는 주문 전체 취소`

피킹 라인은 상품마스터의 `로케이션`을 기준으로 정렬한다. 주문의 모든 라인이 O일 때만 기존 출고 서비스를 통해 재고를 차감하며, X가 있으면 발송대기 예약을 해제한다.

`출고후잔량 = 가용재고 - 발송대기`이며, 잔량이 안전재고 이하가 되면 상품마스터의 `재고상태`에 표시됩니다.

## 공통 특성

- 파일 단위로 처리합니다.
- 상품과 주문은 동일한 `input` 폴더와 단일 시간 기반 트리거를 사용합니다.
- 성공 시 `success` 폴더로 이동해 원본 파일을 보관합니다.
- 실패 시 오류 폴더로 이동합니다.
- 시간 기반 트리거로 자동 실행 가능합니다.
- 상품/주문은 일부 이력 시트와 오류 시트를 공유합니다.
