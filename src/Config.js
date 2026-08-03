const CONFIG = Object.freeze({
  folders: {
    input: "csv_input",
    processed: "csv_processed",
    error: "csv_error"
  },
  sheets: {
    products: "상품마스터",
    errors: "오류목록",
    history: "파일처리이력"
  },
  
  properties: {
    inputFolderId: "CSV_INPUT_FOLDER_ID",
    processedFolderId: "CSV_PROCESSED_FOLDER_ID",
    errorFolderId: "CSV_ERROR_FOLDER_ID"
  },
  triggerHandler: "scanCsvInputFolder",
  triggerMinutes: 5
});

const PRODUCT_HEADERS = Object.freeze([
  "상품품목코드","코드","고객사명","이미지","유형","형태","상품명","관리명",
  "옵션","바코드","입출고","차트","로케이션","보관장소","유효기간",
  "상품진행여부","가용재고","발송대기","안전재고","불량재고","적정재고",
  "출고후잔량","박스내용","박스수량"
]);

const REQUIRED_HEADERS = Object.freeze([
  "상품품목코드",
  "상품명"
]);

const NUMERIC_HEADERS = Object.freeze([
  "가용재고","발송대기","안전재고","불량재고",
  "적정재고","출고후잔량","박스수량"
]);

const PRODUCT_SHEET_HEADERS = Object.freeze([
  ...PRODUCT_HEADERS,
  "원본파일ID",
  "원본파일명",
  "등록일시"
]);
