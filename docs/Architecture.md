# 아키텍처

## 목적

이 프로젝트는 NorthFox Logistics를 위한 Google Apps Script 기반 물류 자동화 시스템입니다.

현재 저장소는 상품 CSV 처리와 주문 CSV 처리를 중심으로 한 JavaScript 운영 코드입니다.

## Product Flow

주요 파일:

- `src/Config.js`
- `src/Setup.js`
- `src/Main.js`
- `src/Productimport.js`
- `src/CsvVaildation.js`
- `src/HistoryAndError.js`

역할:

- 설정, 폴더, 시트, 트리거 준비
- 상품 CSV 파싱과 헤더/행 검증
- 상품 시트 반영
- 오류 및 이력 기록

## Order Flow

주요 파일:

- `src/Order_Config.js`
- `src/Order_Setup.js`
- `src/Order_Main.js`
- `src/Order_CsvParser.js`
- `src/Order_Validator.js`
- `src/Order_SheetRepository.js`
- `src/Order_ErrorService.js`
- `src/Order_DriveService.js`
- `src/Order_DuplicateChecker.js`

역할:

- 주문 CSV 파싱
- 주문/주문상세 검증
- 중복 체크
- 시트 반영과 오류 기록
- 처리 실패 시 롤백 보조

## Shared Helpers

주요 파일:

- `src/TestHelpers.js`
- `src/Order_TestHelpers.js`

샘플 CSV 생성이나 스모크 테스트 용도로 사용하는 보조 함수입니다.

## 의존 방향

`Setup/Main -> parser/validator/import/service helpers -> Google Apps Script APIs`

현재 코드는 전통적인 레이어드 아키텍처보다 기능별 파일 분리에 가깝습니다. 다만 설정, 파싱, 검증, 기록 책임을 분리하는 방향은 유지해야 합니다.

## 조립 지점

상품 처리 흐름은 `src/Main.js`, 주문 처리 흐름은 `src/Order_Main.js`가 조립 지점 역할을 합니다.
설정 준비는 각각 `src/Setup.js`, `src/Order_Setup.js`에서 담당합니다.
