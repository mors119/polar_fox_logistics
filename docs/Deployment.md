# 배포 문서

## 배포 방식

배포는 `src/` 폴더의 JavaScript 파일을 Apps Script 프로젝트로 푸시하는 방식입니다.

흐름:

`src/* -> clasp push -> Google Apps Script`

## 로컬 배포

```bash
npm run push
```

## 배포 전 확인

- `.clasp.json`의 `rootDir`가 `src`인지
- `scriptId`가 올바른 Apps Script 프로젝트를 가리키는지
- `npx clasp login`이 완료되었는지
- 대상 프로젝트가 필요한 권한을 갖추었는지
- Script Properties의 `ROOT_FOLDER_ID`가 설정되어 있는지

## GitHub Actions 배포

현재 워크플로는 아래만 검증합니다.

1. `npm ci`
2. `npm run format`
3. `npm run lint`

배포 워크플로는 CI 성공 후:

1. `CLASP_CREDENTIALS`로 인증 파일 생성
2. `CLASP_SCRIPT_ID`로 `.clasp.json` 생성
3. `rootDir: "src"` 설정
4. `npx clasp push --force`

## 필요한 GitHub Secrets

- `CLASP_CREDENTIALS`
- `CLASP_SCRIPT_ID`
