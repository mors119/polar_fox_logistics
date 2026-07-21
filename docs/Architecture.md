# 아키텍처

## 목적

이 프로젝트는 **NorthFox Logistics**를 위한 Google Apps Script 기반 물류 자동화 시스템입니다.
목표는 주문 수집, 재고 반영, 출고 일정 관리, 배송 추적, 운영 보고를 Google Workspace 중심으로 자동화하는 것입니다.

현재 저장소는 그 목표를 구현하기 위한 기반 구조를 제공하며, 비즈니스 로직이 Google 런타임 API에 직접 묶이지 않도록 설계되어 있습니다.

## 목표 업무 흐름

```text
Cafe24 주문
  -> 주문 데이터 수집
    -> Google Sheets 주문 기록
      -> 재고 자동 차감
        -> 송장 발급
          -> Google Calendar 출고 일정 등록
            -> 배송 조회
              -> 배송 상태 갱신
                -> 대시보드 및 주간 보고서
```

위 흐름 전체가 이미 구현된 것은 아닙니다. 현재 코드는 이 흐름을 안전하게 확장하기 위한 공통 구조와 예시 서비스들을 포함합니다.

## 계층 구조

### Entrypoints

위치: `src/entrypoints/`

- `webapp/`: `doGet`, `doPost`
- `triggers/`: `onOpen`, `onEdit`, `time-trigger`
- `sheets/`: 스프레드시트 메뉴 설치

Entrypoint는 Google Apps Script 이벤트를 받아 애플리케이션 서비스 호출로 변환합니다.

### Application

위치: `src/application/`

- `services/`: 주문 수집, 재고 처리, 보고서 발송 같은 유스케이스 조합 지점
- `ports/`: 외부 시스템 의존성 계약

애플리케이션 계층은 `SpreadsheetApp`, `GmailApp`, `DriveApp`, `CalendarApp`, `UrlFetchApp`을 직접 호출하지 않습니다.

### Domain

위치: `src/domain/`

도메인 계층은 주문, 재고, 배송, 보고서처럼 프로젝트 핵심 데이터를 표현하는 모델과 엔터티를 둡니다.

현재는 샘플 리포트 중심 구조이지만, 이후에는 `Order`, `InventoryItem`, `Shipment`, `WeeklyOperationsSummary` 같은 물류 중심 모델로 확장하는 것을 기준으로 합니다.

### Infrastructure

위치: `src/infrastructure/`

인프라 계층은 포트 구현체를 두는 곳입니다. Google Workspace API, 외부 쇼핑몰 API, 택배 API 연동은 이 계층에서 처리합니다.

## 의존 방향

```text
Entrypoints -> Application -> Domain
                         -> Ports -> Infrastructure -> Google Workspace APIs
                                                 -> External APIs
```

의존성은 안쪽으로만 향해야 합니다. 포트는 애플리케이션에 두고, 실제 구현은 인프라에 둡니다.

## 현재 구현 상태

현재 저장소에는 다음 기반 요소가 준비되어 있습니다.

- Sheets, Gmail, Calendar, Drive, HTTP, UI 어댑터
- 서비스 컨테이너 기반 의존성 조립
- 메뉴 액션 레지스트리
- 샘플 리포트 발송 기능
- 시트 데이터 JSON 스냅샷 저장 기능
- Web App 진입점과 트리거 진입점

즉, 문서상 목표는 물류 자동화 프로젝트이고, 코드상 현재 상태는 그 프로젝트를 올릴 수 있는 자동화 플랫폼 골격에 가깝습니다.

## 조립 지점

`src/config/service-container.ts`는 구성 루트입니다. 아래 항목을 한곳에서 조립합니다.

- 설정 제공자
- 어댑터
- 로거
- 애플리케이션 서비스

이 구조 덕분에 Entrypoint는 얇게 유지되고, 기능 추가 시 변경 지점을 예측하기 쉬워집니다.

`src/config/workspace-actions.ts`는 스프레드시트 메뉴 액션 등록 지점입니다.
새 메뉴 기능은 여기서 등록하므로 `src/index.ts`를 반복 수정하는 충돌을 줄일 수 있습니다.

## 물류 기능 확장 원칙

NorthFox Logistics 기능을 추가할 때는 아래 순서를 따릅니다.

1. 주문, 재고, 배송 등 도메인 모델을 먼저 정의합니다.
2. Cafe24, 택배사, 대시보드 집계에 필요한 포트를 `src/application/ports`에 정의합니다.
3. 유스케이스를 `src/application/services`에 추가합니다.
4. Google Workspace 또는 외부 API 구현을 `src/infrastructure`에 추가합니다.
5. 메뉴, 트리거, 웹훅 같은 노출 지점을 `src/entrypoints`에 연결합니다.

이 원칙을 지키면 기능이 늘어나도 특정 파일 하나에 모든 변경이 몰리는 문제를 줄일 수 있습니다.
