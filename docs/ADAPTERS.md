# 어댑터 문서

이 문서는 NorthFox Logistics 프로젝트에서 사용하는 인프라 어댑터의 역할과 확장 방향을 정리합니다.

## Sheets Adapter

파일: `src/infrastructure/adapters/sheets/sheets.adapter.ts`

현재 책임:

- 시트 생성
- A1 범위 값 읽기
- A1 범위 값 쓰기
- 행 추가

물류 프로젝트에서의 사용 예상:

- 주문관리 시트 적재
- 재고관리 시트 수량 반영
- 배송조회 시트 상태 갱신
- 대시보드 집계용 원본 데이터 기록

시트 관련 런타임 호출은 이 어댑터 내부에만 두는 것을 원칙으로 합니다.

## Gmail Adapter

파일: `src/infrastructure/adapters/gmail/gmail.adapter.ts`

현재 책임:

- 텍스트 메일 발송
- HTML 메일 발송

물류 프로젝트에서의 사용 예상:

- 주간 운영 보고서 발송
- 재고 부족 알림
- 배송 지연 알림

애플리케이션 계층은 `MailPort`만 의존해야 합니다.

## Calendar Adapter

파일: `src/infrastructure/adapters/calendar/calendar.adapter.ts`

현재 책임:

- 일정 생성
- 일정 수정
- 일정 삭제

물류 프로젝트에서의 사용 예상:

- 출고 예정 주문 일정 등록
- 출고 완료 여부 관리
- 작업일 기준 출고량 확인

애플리케이션 계층은 `CalendarPort`를 통해서만 캘린더 기능을 사용합니다.

## Drive Adapter

파일: `src/infrastructure/adapters/drive/drive.adapter.ts`

현재 책임:

- 폴더 보장 생성
- 파일 생성
- 파일 내용 업로드

현재 사용 사례:

- 웹앱 POST payload 저장
- 리포트 시트 JSON 스냅샷 저장

물류 프로젝트에서는 다음 용도로도 확장할 수 있습니다.

- 주문 원본 백업
- 일별 운영 산출물 보관
- API 응답 감사 로그 저장

## HTTP Adapter

파일: `src/infrastructure/http/apps-script-http.adapter.ts`

현재 책임:

- 외부 HTTP 요청
- JSON 응답 파싱
- 비정상 응답 처리

물류 프로젝트에서의 사용 예상:

- Cafe24 주문 API 호출
- 택배 송장 발급 API 호출
- 배송 조회 API 호출

외부 API URL, 토큰, 헤더 정책은 애플리케이션 서비스가 아니라 `ConfigService`와 포트 계약으로 관리합니다.

## UI Adapter

파일: `src/infrastructure/adapters/ui/apps-script-ui.adapter.ts`

현재 책임:

- 스프레드시트 메뉴 생성
- 알림창 표시

현재 프로젝트에서는 작업자가 직접 실행할 수 있는 메뉴 액션 진입점으로 사용합니다.

예시:

- 일일 리포트 실행
- 리포트 스냅샷 저장
- 도움말 표시

## 향후 추가 가능 어댑터

NorthFox Logistics를 실제 운영 단계까지 확장하려면 아래 어댑터가 추가될 가능성이 큽니다.

- Cafe24 주문 수집 어댑터
- 택배사 송장 발급 어댑터
- 배송 상태 조회 어댑터
- 운영 대시보드 집계 어댑터

새 어댑터를 추가할 때는 반드시 먼저 포트를 정의한 뒤 구현을 붙입니다.
