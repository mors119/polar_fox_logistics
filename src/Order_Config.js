const ORDER_CONFIG = Object.freeze({
  folders: {
    input: "order_csv_input",
    processed: "order_csv_processed",
    error: "order_csv_error"
  },
  sheets: {
    orders: "주문",
    orderItems: "주문상품",
    errors: CONFIG.sheets.errors,
    history: CONFIG.sheets.history
  },
  properties: {
    inputFolderId: "ORDER_CSV_INPUT_FOLDER_ID",
    processedFolderId: "ORDER_CSV_PROCESSED_FOLDER_ID",
    errorFolderId: "ORDER_CSV_ERROR_FOLDER_ID"
  },
  triggerHandler: "scanOrderFolder",
  triggerMinutes: 5,
  defaultOrderStatus: "신규",
  defaultOrderItemStatus: "등록완료",
  defaultErrorStatus: "미처리"
});

const ORDER_CSV_HEADERS = Object.freeze([
  "쇼핑몰",
  "쇼핑몰 번호",
  "주문번호",
  "품목별 주문번호",
  "배송메세지",
  "총주문금액",
  "결제금액",
  "상품품목코드",
  "주문상품명",
  "상품옵션",
  "수량",
  "판매가",
  "수령인",
  "수령인 휴대전화",
  "수령인 우편번호",
  "수령인 주소"
]);

const REQUIRED_ORDER_HEADERS = Object.freeze([
  "주문번호",
  "품목별 주문번호",
  "상품품목코드",
  "주문상품명",
  "수량",
  "수령인",
  "수령인 주소"
]);

const ORDER_SHEET_HEADERS = Object.freeze([
  "주문번호",
  "쇼핑몰",
  "쇼핑몰 번호",
  "배송메세지",
  "총주문금액",
  "결제금액",
  "수령인",
  "수령인 휴대전화",
  "수령인 우편번호",
  "수령인 주소",
  "주문상태",
  "송장번호",
  "원본파일ID",
  "원본파일명",
  "등록일시"
]);

const ORDER_ITEM_SHEET_HEADERS = Object.freeze([
  "품목별 주문번호",
  "주문번호",
  "상품품목코드",
  "주문상품명",
  "상품옵션",
  "수량",
  "판매가",
  "처리상태",
  "원본파일ID",
  "원본파일명",
  "등록일시"
]);

const ERROR_SHEET_HEADERS = Object.freeze([
  "오류ID",
  "발생일시",
  "파일ID",
  "파일명",
  "처리단계",
  "행번호",
  "주문번호",
  "품목별 주문번호",
  "오류코드",
  "오류메시지",
  "처리상태"
]);

const FILE_HISTORY_HEADERS = Object.freeze([
  "파일ID",
  "파일명",
  "처리상태",
  "총행수",
  "주문등록수",
  "주문상품등록수",
  "오류건수",
  "처리시작시각",
  "처리종료시각",
  "메시지"
]);

const ORDER_HEADER_CONSISTENCY_FIELDS = Object.freeze([
  "쇼핑몰",
  "쇼핑몰 번호",
  "배송메세지",
  "총주문금액",
  "결제금액",
  "수령인",
  "수령인 휴대전화",
  "수령인 우편번호",
  "수령인 주소"
]);

const ORDER_NUMERIC_OPTIONAL_HEADERS = Object.freeze([
  "판매가",
  "총주문금액",
  "결제금액"
]);
