# 운영 준비 문서

## 초기 실행 순서

1. Google Drive에 상위 작업 폴더 하나 생성
2. Script Properties에 `ROOT_FOLDER_ID` 저장
3. `setupSystem()` 실행
4. 생성된 입력 폴더와 운영 스프레드시트 확인
5. 샘플 CSV 업로드 후 `scanCsvInputFolder()` 또는 `scanOrderFolder()` 테스트

## 생성되어야 하는 폴더

- `csv_input`
- `order_csv_input`
- `error`

## 생성되어야 하는 시트

- 운영 스프레드시트 1개
- `상품마스터`
- `주문`
- `주문상품`
- `설정`
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
- `setupSystem()` 실행 후 반환된 폴더 URL을 확인하지 않음

## 처리 결과 확인 위치

### 성공

- 상품: `상품마스터`
- 주문: `주문`, `주문상품`
- 입력 파일이 휴지통으로 이동했는지 확인

### 실패

- `오류목록`
- `파일처리이력`
- 입력 파일이 `error` 폴더로 이동했는지 확인
