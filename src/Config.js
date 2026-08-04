// 상품 CSV 처리 흐름에서 공통으로 사용하는 폴더, 시트, 트리거 설정이다.
const CONFIG = Object.freeze({
  folders: {
    input: 'csv_input',
  },
  sheets: {
    settings: '설정',
    products: '상품마스터',
    errors: '오류목록',
    history: '파일처리이력',
  },
  settingsKeys: {
    backupEmail: '백업 메일 주소',
    backupSheets: '백업 대상 시트',
    backupWeekday: '백업 요일',
    backupTime: '백업 시간',
  },

  properties: {
    rootFolderId: 'ROOT_FOLDER_ID',
    spreadsheetId: 'OPERATIONS_SPREADSHEET_ID',
    inputFolderId: 'CSV_INPUT_FOLDER_ID',
  },
  backupExportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  spreadsheetName: 'polar_fox_logistics',
  triggerHandler: 'scanCsvInputFolder',
  triggerMinutes: 5,
});

// 상품 CSV에서 허용하는 전체 헤더 목록이다.
const PRODUCT_HEADERS = Object.freeze([
  '상품품목코드',
  '코드',
  '고객사명',
  '이미지',
  '유형',
  '형태',
  '상품명',
  '관리명',
  '옵션',
  '바코드',
  '입출고',
  '차트',
  '로케이션',
  '보관장소',
  '유효기간',
  '상품진행여부',
  '가용재고',
  '발송대기',
  '안전재고',
  '불량재고',
  '적정재고',
  '출고후잔량',
  '박스내용',
  '박스수량',
]);

// 최소한 반드시 들어와야 하는 헤더만 따로 분리한다.
const REQUIRED_HEADERS = Object.freeze(['상품품목코드', '상품명']);

// 숫자로 변환해서 시트에 넣어야 하는 헤더 목록이다.
const NUMERIC_HEADERS = Object.freeze([
  '가용재고',
  '발송대기',
  '안전재고',
  '불량재고',
  '적정재고',
  '출고후잔량',
  '박스수량',
]);

// 실제 상품마스터 시트에는 원본 파일 추적용 컬럼을 뒤에 덧붙여 저장한다.
const PRODUCT_SHEET_HEADERS = Object.freeze([
  ...PRODUCT_HEADERS,
  '원본파일ID',
  '원본파일명',
  '등록일시',
]);

// 설정 시트에서 사용자 입력을 받을 기본 행이다.
const SETTINGS_SHEET_ROWS = Object.freeze([
  ['백업 메일 주소', '', '백업 파일을 받을 이메일 주소'],
  ['백업 대상 시트', '', '쉼표로 구분한 시트명 예: 상품마스터,주문,주문상품'],
  ['백업 요일', '', '매일 또는 월,화,수,목,금,토,일 중 하나'],
  ['백업 시간', '', '24시간 형식 HH:mm 예: 09:00'],
]);
