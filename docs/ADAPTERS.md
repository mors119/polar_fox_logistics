# 연동 문서

현재 프로젝트는 별도 adapter 계층 없이 Google Apps Script JS 파일을 기능별로 나누는 구조입니다.

## Drive/Folder 연동

관련 파일:

- `src/Setup.js`
- `src/Main.js`
- `src/Order_Setup.js`
- `src/Order_DriveService.js`

현재 책임:

- 입력/처리완료/오류 폴더 확인 또는 생성
- 처리 완료 파일 이동
- 오류 파일 이동

## Spreadsheet 연동

관련 파일:

- `src/Setup.js`
- `src/Productimport.js`
- `src/HistoryAndError.js`
- `src/Order_Setup.js`
- `src/Order_SheetRepository.js`
- `src/Order_ErrorService.js`

현재 책임:

- 상품, 주문, 주문상세, 이력, 오류 시트 생성
- CSV 데이터 시트 적재
- 오류/이력 로그 기록
- 필요 시 롤백 보조

## CSV 파싱 및 검증

관련 파일:

- `src/CsvVaildation.js`
- `src/Order_CsvParser.js`
- `src/Order_Validator.js`

현재 책임:

- CSV 텍스트 파싱
- 헤더 검증
- 행 단위 데이터 검증
- 중복 체크 전처리

## 향후 확장 방향

- 설정값은 `Config` 계열 파일에서 관리합니다.
- API 호출은 전용 파일로 분리합니다.
- 파싱, 검증, 적재, 기록 책임을 한 파일에 몰아넣지 않습니다.
