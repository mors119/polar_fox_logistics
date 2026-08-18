# Polar Fox

## 기능

- 상품·주문 파일 자동 적재
  - `scanInputFolder()` 형식 판별 → 재고 동기화·주문 저장·재고 예약
- 상품 등록·입고 처리
  - `approveNewProduct()` 상품 승인 · `confirmInbound()` 정상·불량 재고 증가
- 피킹 지시·결과 반영
  - `createPickingInstruction()` 재고 가능 주문만 묶음 생성 · `syncPickingResults()` 출고 차감·취소 복원
- 재고·주문·피킹 현황
  - `refreshOperationsDashboards_()` 현황·진행률·안전재고·교차검증 갱신
- 오류·이력·백업 관리
  - 실패 기록·처리 이력 · `sendConfiguredBackupEmail()` 정기 백업

## 생성 파일

- `01_관리자용`
- `02_업무인원용`
