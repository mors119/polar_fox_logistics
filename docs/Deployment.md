# 배포 문서

## 배포 목적

이 저장소의 배포는 NorthFox Logistics 자동화 코드를 Google Apps Script 프로젝트에 반영하는 과정입니다.

기본 흐름은 아래와 같습니다.

`JavaScript source in src/ -> clasp push -> Google Apps Script`

## 로컬 배포

기본 명령:

- `npm run push`
- `npm run pull`

## 배포 전 확인 사항

- 대상 Apps Script 프로젝트가 준비되어 있는지
- `scriptId`가 올바른지
- `clasp login`한 계정이 해당 프로젝트 수정 권한을 가지는지
- `.clasp.json`의 `rootDir`가 `src`인지
- Script Properties가 운영 환경 기준으로 설정되어 있는지

## GitHub Actions 배포

CI는 최소한 아래 항목을 검증해야 합니다.

1. 의존성 설치
2. 포맷 검사
3. 린트
4. 필요한 경우 샘플 데이터 기반 수동 검증

배포 단계는 다음 순서를 따릅니다.

1. `main` 브랜치 기준 CI 성공 이후 실행
2. `CLASP_CREDENTIALS`로 `~/.clasprc.json` 생성
3. `CLASP_SCRIPT_ID`로 `.clasp.json` 생성
4. `rootDir`를 `src`로 설정
5. `clasp push --force` 실행

## 필수 시크릿

- `CLASP_CREDENTIALS`
- `CLASP_SCRIPT_ID`
