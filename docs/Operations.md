# 운영 준비 문서

## 초기 실행 순서

상품과 주문은 각각 별도 초기화가 필요합니다.

1. 스프레드시트에 바인드된 Apps Script 프로젝트 열기
2. `setupSystem()` 실행
3. `setupOrderCsvSystem()` 실행
4. 생성된 폴더와 시트 확인
5. 샘플 CSV 업로드 후 `scanCsvInputFolder()` 또는 `scanOrderFolder()` 테스트

## 생성되어야 하는 폴더

### 상품

- `csv_input`
- `csv_processed`
- `csv_error`

### 주문

- `order_csv_input`
- `order_csv_processed`
- `order_csv_error`

## 생성되어야 하는 시트

- `상품마스터`
- `주문`
- `주문상품`
- `오류목록`
- `파일처리이력`

## 파일 투입 위치

- 상품 CSV: `csv_input`
- 주문 CSV: `order_csv_input`

다른 폴더에 넣으면 처리되지 않습니다.

## 자주 발생하는 실수

- `sample_order.cvs`처럼 확장자를 잘못 올림
- 주문 파일을 `csv_input`에 넣음
- standalone Apps Script에서 `setupSystem()` 실행
- `setupOrderCsvSystem()`을 실행하지 않아 주문용 폴더가 아예 없음

## 처리 결과 확인 위치

### 성공

- 상품: `상품마스터`
- 주문: `주문`, `주문상품`
- 처리완료 폴더로 이동 여부 확인

### 실패

- `오류목록`
- `파일처리이력`
- 오류 폴더 이동 여부 확인
