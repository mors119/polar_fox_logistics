# 개발 문서

## 프로젝트 성격

이 저장소는 북극여우 스토어의 주문, 재고, 출고, 배송 업무를 자동화하기 위한 Google Apps Script 기반 JavaScript 프로젝트입니다.

현재 코드는 상품 CSV 처리와 주문 CSV 처리를 중심으로 구성되어 있습니다.

## 로컬 개발 준비

1. `npm install`로 의존성을 설치합니다.
2. `.clasp.json.example`을 `.clasp.json`으로 복사합니다.
3. `npx clasp login`으로 인증합니다.
4. 대상 Apps Script 프로젝트에 필요한 Script Properties를 설정합니다.

## 주요 명령어

- `npm run format`
- `npm run format:write`
- `npm run lint`
- `npm run lint:fix`
- `npm run push`
- `npm run pull`

## 현재 포함 기능

- 상품 CSV를 읽어 상품마스터 시트에 반영
- 주문 CSV를 읽어 주문/주문상세 시트에 반영
- 처리 이력과 오류 로그 기록
- 폴더, 시트, 시간 기반 트리거 초기 설정

## 기능 확장 패턴

1. `src/Config.js` 또는 `src/Order_Config.js`에 설정값을 추가합니다.
2. 파싱 로직은 `src/CsvVaildation.js` 또는 `src/Order_CsvParser.js`에 반영합니다.
3. 검증 규칙은 `src/Productimport.js` 또는 `src/Order_Validator.js`에 추가합니다.
4. 처리 흐름은 `src/Main.js` 또는 `src/Order_Main.js`에 연결합니다.
5. 초기 설정이나 트리거 변경은 `src/Setup.js` 또는 `src/Order_Setup.js`에서 처리합니다.
6. 오류/이력 기록 형식이 바뀌면 관련 서비스 파일도 함께 수정합니다.

## NorthFox Logistics 확장 후보

- Cafe24 주문 수집 서비스
- 재고 자동 차감 서비스
- 송장 발급 서비스
- 배송 상태 동기화 서비스
- 주간 운영 요약 리포트 서비스
- 운영 대시보드 집계 서비스
