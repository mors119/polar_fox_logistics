# 구성 요소 문서

이 프로젝트는 별도 adapter 계층 대신 기능별 GAS 파일 분리 구조를 사용합니다.

## 폴더/파일 이동

- `src/Setup.js`
- `src/Order_Setup.js`
- `src/Order_DriveService.js`
- `src/HistoryAndError.js`

역할:

- 입력 폴더 찾기 또는 생성
- 처리완료/오류 폴더 찾기 또는 생성
- 처리 후 파일 이동

## 시트 접근

- `src/Setup.js`
- `src/Order_Setup.js`
- `src/HistoryAndError.js`
- `src/Order_SheetRepository.js`
- `src/Order_ErrorService.js`

역할:

- 시트 생성
- 헤더 보장
- 데이터 행 추가
- 이력/오류 기록

## 검증

- `src/CsvVaildation.js`
- `src/Order_CsvParser.js`
- `src/Order_Validator.js`
- `src/Order_DuplicateChecker.js`

역할:

- CSV 파싱
- 헤더 유효성 검사
- 데이터 형식 검사
- 중복 검사
