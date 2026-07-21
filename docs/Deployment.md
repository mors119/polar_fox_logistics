# 배포 문서

## 배포 목적

이 저장소의 배포는 NorthFox Logistics 자동화 코드를 Google Apps Script 프로젝트에 반영하는 과정입니다.

기본 흐름은 아래와 같습니다.

`TypeScript -> esbuild -> dist -> clasp push -> Google Apps Script`

`esbuild`는 `dist/Code.js`를 생성하고 `appsscript.json`을 `dist/`로 복사합니다.

## 로컬 배포

로컬에서 사용하는 기본 명령:

- `npm run build`
- `npm run push`
- `npm run deploy:local`

`deploy:local`은 로컬 확인용 편의 명령입니다.
공유된 운영 반영 기준은 가능한 한 GitHub Actions를 사용하는 것을 권장합니다.

## 배포 전 확인 사항

- 대상 Apps Script 프로젝트가 준비되어 있는지
- `scriptId`가 올바른지
- `clasp login`한 계정이 해당 프로젝트 수정 권한을 가지는지
- Script Properties가 운영 환경 기준으로 설정되어 있는지

예상 주요 설정값:

- `REPORT_RECIPIENT`
- `REPORT_SHEET_NAME`
- `REPORT_RANGE`
- `REPORT_DRIVE_FOLDER`
- `REPORT_SNAPSHOT_FOLDER`
- `DEFAULT_CALENDAR_ID`
- `EXTERNAL_API_URL`
- `EXTERNAL_API_TOKEN`

향후 물류 연동 확장 시 아래 값이 추가될 수 있습니다.

- `CAFE24_API_URL`
- `CAFE24_ACCESS_TOKEN`
- `SHIPPING_API_URL`
- `SHIPPING_API_TOKEN`

## GitHub Actions 배포

CI는 최소한 아래 항목을 검증해야 합니다.

1. 의존성 설치
2. 포맷 검사
3. 린트
4. 타입 체크
5. 테스트
6. 빌드

배포 단계는 다음 순서를 따릅니다.

1. `main` 브랜치 기준 CI 성공 이후 실행
2. 프로젝트 재빌드
3. `CLASP_CREDENTIALS`로 `~/.clasprc.json` 생성
4. `CLASP_SCRIPT_ID`로 `.clasp.json` 생성
5. `clasp push --force` 실행

## 필수 시크릿

- `CLASP_CREDENTIALS`
- `CLASP_SCRIPT_ID`

## 운영 반영 시 주의점

- `clasp push --force`는 Apps Script HEAD 소스를 덮어씁니다.
- Google Sheets 구조가 바뀌는 변경은 운영 시트 백업 이후 반영하는 것이 안전합니다.
- 외부 API 연동 기능이 들어간 뒤에는 운영 토큰과 테스트 토큰을 분리해야 합니다.
- 재고 차감, 배송 상태 변경 같은 쓰기 작업은 테스트 환경에서 먼저 검증해야 합니다.

## 권장 배포 전략

NorthFox Logistics는 운영 데이터 민감도가 높기 때문에 아래 전략을 권장합니다.

1. 개발용 Apps Script 프로젝트에서 먼저 검증합니다.
2. 테스트용 스프레드시트로 메뉴와 트리거 동작을 확인합니다.
3. 운영 배포 전 Script Properties를 다시 검토합니다.
4. 배포 직후 주문, 재고, 출고 관련 주요 시트를 샘플 점검합니다.
