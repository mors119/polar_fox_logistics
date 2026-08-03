// 주문 CSV 처리 흐름에서 사용하는 폴더, 시트, 트리거 설정이다.
const ORDER_CONFIG = Object.freeze({
  folders: {
    input: 'order_csv_input',
    processed: 'order_csv_processed',
    error: 'order_csv_error',
  },
  sheets: {
    orders: '주문',
    orderItems: '주문상품',
    errors: CONFIG.sheets.errors,
    history: CONFIG.sheets.history,
  },
  properties: {
    inputFolderId: 'ORDER_CSV_INPUT_FOLDER_ID',
    processedFolderId: 'ORDER_CSV_PROCESSED_FOLDER_ID',
    errorFolderId: 'ORDER_CSV_ERROR_FOLDER_ID',
  },
  triggerHandler: 'scanOrderFolder',
  triggerMinutes: 5,
  defaultOrderStatus: '신규',
  defaultOrderItemStatus: '등록완료',
  defaultErrorStatus: '미처리',
});

// 주문 CSV에서 허용하는 전체 헤더 목록이다.
const ORDER_CSV_HEADERS = Object.freeze([
  '쇼핑몰',
  '쇼핑몰 번호',
  '주문번호',
  '품목별 주문번호',
  '배송메세지',
  '총주문금액',
  '결제금액',
  '상품품목코드',
  '주문상품명',
  '상품옵션',
  '수량',
  '판매가',
  '수령인',
  '수령인 휴대전화',
  '수령인 우편번호',
  '수령인 주소',
]);

// 주문 적재를 위해 반드시 필요한 헤더만 별도로 정의한다.
const REQUIRED_ORDER_HEADERS = Object.freeze([
  '주문번호',
  '품목별 주문번호',
  '상품품목코드',
  '주문상품명',
  '수량',
  '수령인',
  '수령인 주소',
]);

// 주문 시트에는 주문 단위 정보만 한 번씩 저장한다.
const ORDER_SHEET_HEADERS = Object.freeze([
  '주문번호',
  '쇼핑몰',
  '쇼핑몰 번호',
  '배송메세지',
  '총주문금액',
  '결제금액',
  '수령인',
  '수령인 휴대전화',
  '수령인 우편번호',
  '수령인 주소',
  '주문상태',
  '송장번호',
  '원본파일ID',
  '원본파일명',
  '등록일시',
]);

// 주문상품 시트에는 CSV의 각 행을 품목 단위로 저장한다.
const ORDER_ITEM_SHEET_HEADERS = Object.freeze([
  '품목별 주문번호',
  '주문번호',
  '상품품목코드',
  '주문상품명',
  '상품옵션',
  '수량',
  '판매가',
  '처리상태',
  '원본파일ID',
  '원본파일명',
  '등록일시',
]);

// 주문 오류 로그는 주문번호와 품목별 주문번호를 함께 보관한다.
const ERROR_SHEET_HEADERS = Object.freeze([
  '오류ID',
  '발생일시',
  '파일ID',
  '파일명',
  '처리단계',
  '행번호',
  '주문번호',
  '품목별 주문번호',
  '오류코드',
  '오류메시지',
  '처리상태',
]);

// 파일처리이력 시트는 상품/주문 흐름이 함께 사용한다.
const FILE_HISTORY_HEADERS = Object.freeze([
  '파일ID',
  '파일명',
  '처리상태',
  '총행수',
  '주문등록수',
  '주문상품등록수',
  '오류건수',
  '처리시작시각',
  '처리종료시각',
  '메시지',
]);

// 같은 주문번호 안에서 일관되어야 하는 필드를 따로 관리한다.
const ORDER_HEADER_CONSISTENCY_FIELDS = Object.freeze([
  '쇼핑몰',
  '쇼핑몰 번호',
  '배송메세지',
  '총주문금액',
  '결제금액',
  '수령인',
  '수령인 휴대전화',
  '수령인 우편번호',
  '수령인 주소',
]);

// 비어 있어도 되지만 값이 있으면 숫자여야 하는 필드들이다.
const ORDER_NUMERIC_OPTIONAL_HEADERS = Object.freeze(['판매가', '총주문금액', '결제금액']);
