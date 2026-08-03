# 운영 준비 문서

## 초기 실행 순서

상품과 주문은 각각 별도 초기화가 필요합니다.

1. Google Drive에 상위 작업 폴더 하나 생성
2. Script Properties에 `ROOT_FOLDER_ID` 저장
3. `setupSystem()` 실행
4. `setupOrderCsvSystem()` 실행
5. 생성된 입력 폴더와 운영 스프레드시트 확인
6. 샘플 CSV 업로드 후 `scanCsvInputFolder()` 또는 `scanOrderFolder()` 테스트

## 생성되어야 하는 폴더

### 상품

- `csv_input`

### 주문

- `order_csv_input`

## 생성되어야 하는 시트

- 운영 스프레드시트 1개
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
- `ROOT_FOLDER_ID`를 넣지 않고 `setupSystem()` 실행
- `setupOrderCsvSystem()`을 실행하지 않아 주문용 입력 폴더가 아예 없음

## 처리 결과 확인 위치

### 성공

- 상품: `상품마스터`
- 주문: `주문`, `주문상품`
- 입력 파일이 휴지통으로 이동했는지 확인

### 실패

- `오류목록`
- `파일처리이력`
- 입력 파일이 휴지통으로 이동했는지 확인
