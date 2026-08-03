# 개발 문서

## 개발 전제

- Apps Script 소스는 `src/` 아래 JavaScript 파일입니다.
- `clasp push` 시 빌드 단계 없이 `src/`가 그대로 반영됩니다.
- 초기화 함수는 모두 **바인드된 Google Sheets** 환경에서 실행해야 합니다.

## 로컬 준비

1. `npm install`
2. `.clasp.json.example` 기반으로 `.clasp.json` 생성
3. `npx clasp login`
4. 대상 Apps Script 프로젝트가 Google Sheets 바인드 프로젝트인지 확인

## 개발 명령

- `npm run format`
- `npm run format:write`
- `npm run lint`
- `npm run lint:fix`
- `npm run pull`
- `npm run push`

## 실제 개발 흐름

### 상품 CSV 기능 수정 시

1. `src/Config.js`에서 헤더/시트/폴더 설정 확인
2. `src/CsvVaildation.js`에서 파싱/검증 규칙 수정
3. `src/Productimport.js`에서 적재 규칙 수정
4. `src/Main.js`에서 흐름 수정
5. 필요한 경우 `src/Setup.js`에서 초기화 구조 수정

### 주문 CSV 기능 수정 시

1. `src/Order_Config.js`에서 헤더/시트/폴더 설정 확인
2. `src/Order_CsvParser.js`에서 파싱 수정
3. `src/Order_Validator.js`에서 검증 규칙 수정
4. `src/Order_DuplicateChecker.js`에서 중복 정책 수정
5. `src/Order_SheetRepository.js`에서 적재/롤백 수정
6. `src/Order_Main.js`에서 메인 흐름 수정
7. 필요한 경우 `src/Order_Setup.js`에서 초기화 구조 수정

## 수동 확인 포인트

- 상품 CSV는 `csv_input`만 감시하는지
- 주문 CSV는 `order_csv_input`만 감시하는지
- 파일 확장자가 `.csv`인지
- 오류 발생 시 오류 폴더와 오류 시트가 같이 갱신되는지
- 성공 시 처리완료 폴더로 이동하는지
