# 개발 문서

## 프로젝트 성격

이 저장소는 Google Apps Script 기반 운영 자동화 애플리케이션입니다.  
새 기능을 추가할 때는 계층 분리보다 개발 속도와 읽기 쉬움을 우선합니다.

## 로컬 개발 준비

1. `npm install`
2. `.clasp.json`을 만들고 Script ID를 넣습니다.
3. `npx clasp login`
4. Script Properties 설정

## 주요 명령어

- `npm run format`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run push`

## 권장 개발 순서

1. 어떤 업무 흐름인지 먼저 정합니다.
2. 해당 기능 폴더를 정합니다.
3. 기능 함수와 필요한 타입을 같은 폴더에 둡니다.
4. 공통으로 쓸 가치가 명확할 때만 `src/shared`로 올립니다.
5. `src/index.ts`에서 Apps Script 진입점에 연결합니다.
6. Vitest 테스트와 문서를 갱신합니다.

## 현재 예시 기능

- 일일 리포트 메일 발송
- 리포트 스냅샷 Drive 저장
- Web App POST payload 저장
- `onOpen`, `onEdit`, 시간 트리거

## 테스트 전략

- 기능 함수 단위 테스트를 우선합니다.
- Apps Script 전역 객체는 직접 실행하지 않고 fake 함수로 대체합니다.
- 얇은 `shared` 래퍼는 단순하게 유지하고 복잡성을 쌓지 않습니다.

## 기능 확장 패턴

예를 들어 주문 수집 기능을 추가한다면:

1. `src/orders/` 같은 기능 폴더를 만듭니다.
2. `collect-orders.ts`, `save-orders.ts`, `types.ts`처럼 직접적인 파일명을 사용합니다.
3. Sheets, Drive, HTTP 호출이 필요하면 `src/shared` 함수를 그대로 사용합니다.
4. 메뉴, 트리거, 웹훅 중 필요한 진입점에만 연결합니다.

중요한 기준:

- 한 기능을 여러 계층으로 쪼개지 않습니다.
- 구현이 하나뿐인 인터페이스는 만들지 않습니다.
- 상태가 필요하지 않다면 클래스를 만들지 않습니다.
