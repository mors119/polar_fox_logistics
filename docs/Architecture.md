# 아키텍처

## 구조 요약

이 프로젝트는 계층형 프레임워크가 아니라, Google Apps Script 전역 함수 파일을 역할별로 분리한 구조입니다.

핵심 흐름은 두 개입니다.

- 상품 CSV 처리
- 주문 CSV 처리

## 상품 CSV 처리 구조

- `src/Setup.js`: 폴더, 시트, 트리거 준비
- `src/Main.js`: 파일 순회와 메인 제어
- `src/CsvVaildation.js`: CSV 파싱, 헤더 검사, 행 검사
- `src/Productimport.js`: 상품마스터 시트 중복 검사와 적재
- `src/HistoryAndError.js`: 오류/이력 기록, 공통 시트 접근

실행 흐름:

`scanCsvInputFolder() -> processCsvFile_() -> parse/validate -> duplicate check -> import -> move file -> history`

## 주문 CSV 처리 구조

- `src/Order_Setup.js`: 주문용 폴더, 시트, 트리거 준비
- `src/Order_Main.js`: 주문 파일 순회와 메인 제어
- `src/Order_CsvParser.js`: 주문 CSV 파싱
- `src/Order_Validator.js`: 헤더/행 검증
- `src/Order_DuplicateChecker.js`: 파일 및 품목번호 중복 검사
- `src/Order_SheetRepository.js`: 주문/주문상품 적재, 롤백
- `src/Order_ErrorService.js`: 주문 오류/이력 기록
- `src/Order_DriveService.js`: 주문 입력 폴더 접근, 파일 이동

실행 흐름:

`scanOrderFolder() -> processOrderFile() -> parse/validate -> duplicate check -> import orders -> import order items -> move file -> history`

## 공통 특성

- 파일 단위로 처리합니다.
- 성공 시 완료 폴더로 이동합니다.
- 실패 시 오류 폴더로 이동합니다.
- 시간 기반 트리거로 자동 실행 가능합니다.
- 상품/주문은 일부 이력 시트와 오류 시트를 공유합니다.
