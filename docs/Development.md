# 개발 문서

## 프로젝트 성격

이 저장소는 북극여우 스토어의 주문, 재고, 출고, 배송 업무를 자동화하기 위한 Google Apps Script 기반 프로젝트입니다.

현재는 공통 자동화 골격과 샘플 기능이 포함되어 있으며, 이후 Cafe24 주문 수집과 배송 API 연동 같은 실제 물류 기능을 단계적으로 올리는 구조입니다.

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
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run push`
- `npm run deploy:local`
- `npm run pull`

## 권장 개발 순서

1. 먼저 어떤 업무를 자동화할지 정합니다.
2. 필요한 시트 구조와 설정값을 정의합니다.
3. 포트를 추가하거나 기존 포트를 재사용합니다.
4. 애플리케이션 서비스를 구현합니다.
5. 필요한 어댑터를 연결합니다.
6. 메뉴, 트리거, 웹앱 등 실행 지점을 연결합니다.
7. 테스트와 문서를 갱신합니다.

## 현재 예시 기능

현재 코드베이스에는 아래 기능이 예시로 포함되어 있습니다.

- 시트 데이터를 읽어 Gmail로 리포트를 보내는 기능
- 시트 데이터를 Drive JSON 파일로 스냅샷 저장하는 기능
- Web App POST payload 저장 기능
- `onEdit`, `onOpen`, 시간 트리거 진입점

이 예시들은 실제 물류 기능의 최종 구현이라기보다, 기능 추가 방식의 기준 예제로 보는 것이 맞습니다.

## 테스트 전략

Vitest 테스트는 주로 애플리케이션 계층을 대상으로 합니다.
Apps Script 전역 객체가 필요한 어댑터는 Node 단위 테스트에서 직접 검증하기보다 mock, fake, 또는 상위 수준 검증으로 다룹니다.

## 기능 확장 패턴

새 유스케이스를 추가할 때는 아래 순서를 권장합니다.

1. `src/application/ports`에 필요한 포트를 추가하거나 재사용합니다.
2. `src/application/services`에 유스케이스 서비스를 작성합니다.
3. `src/infrastructure`에 포트 구현을 추가합니다.
4. `src/config/service-container.ts`에 서비스를 연결합니다.
5. 메뉴 실행 기능이면 `src/config/workspace-actions.ts`에 등록합니다.
6. 트리거나 웹훅이 필요하면 `src/entrypoints`에 연결합니다.
7. fake 포트를 이용한 Vitest 테스트를 추가합니다.

## NorthFox Logistics 확장 후보

다음 기능은 현재 구조 위에서 우선적으로 확장할 수 있습니다.

- Cafe24 주문 수집 서비스
- 재고 자동 차감 서비스
- 송장 발급 서비스
- 배송 상태 동기화 서비스
- 주간 운영 요약 리포트 서비스
- 운영 대시보드 집계 서비스
