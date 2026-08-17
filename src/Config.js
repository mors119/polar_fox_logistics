// 상품 CSV 처리 흐름에서 공통으로 사용하는 폴더, 시트, 트리거 설정이다.
const CONFIG = Object.freeze({
  folders: {
    input: 'input',
    success: 'success',
    error: 'error',
  },
  sheets: {
    settings: '설정',
    products: '상품마스터',
    productRegistration: '상품등록',
    inboundPending: '대기작업',
    inboundCompleted: '완료작업',
    inboundErrors: '오류작업',
    pickingHeaders: '피킹헤더',
    pickingLines: '피킹라인',
    inventoryDashboard: '📊 재고현황',
    orderDashboard: '📊 주문현황',
    pickingDashboard: '📊 피킹현황',
    crossCheckDashboard: '🔗 교차검증',
    completedOrders: '주문(완료)',
    inventoryHistory: '재고이력',
    errors: '오류목록',
    history: '파일처리이력',
  },
  settingsKeys: {
    inputTriggerMinutes: '입력 트리거 분',
    operatingWeekdays: '운영 요일',
    operatingStartTime: '운영 시작 시간',
    operatingEndTime: '운영 종료 시간',
    backupEmail: '백업 메일 주소',
    backupSheets: '백업 대상 시트',
    backupWeekday: '백업 요일',
    backupTime: '백업 시간',
    pickingAssignees: '피킹 담당자',
    pickingAssignmentUnit: '담당자별 주문수',
    pickingTriggerMinutes: '피킹 반영 트리거 분',
  },

  properties: {
    rootFolderId: 'ROOT_FOLDER_ID',
    spreadsheetId: 'OPERATIONS_SPREADSHEET_ID',
    mainSpreadsheetId: 'MAIN_SPREADSHEET_ID',
    inboundSpreadsheetId: 'INBOUND_SPREADSHEET_ID',
    pickingSpreadsheetId: 'PICKING_SPREADSHEET_ID',
    dashboardSpreadsheetId: 'DASHBOARD_SPREADSHEET_ID',
    inputFolderId: 'INPUT_FOLDER_ID',
    successFolderId: 'SUCCESS_FOLDER_ID',
    errorFolderId: 'ERROR_FOLDER_ID',
    inventoryModelVersion: 'INVENTORY_MODEL_VERSION',
  },
  backupExportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  spreadsheetFiles: {
    main: '01_메인데이터_수정금지',
    inbound: '02_상품입고_작업',
    picking: '03_피킹_작업',
    dashboard: '04_운영대시보드_조회용',
  },
  triggerHandler: 'scanInputFolder',
  backupTriggerHandler: 'sendConfiguredBackupEmail',
  pickingTriggerHandler: 'syncPickingResults',
  triggerMinutes: 5,
});

const SPREADSHEET_GROUP_PROPERTIES = Object.freeze({
  main: CONFIG.properties.mainSpreadsheetId,
  inbound: CONFIG.properties.inboundSpreadsheetId,
  picking: CONFIG.properties.pickingSpreadsheetId,
  dashboard: CONFIG.properties.dashboardSpreadsheetId,
});

const SHEET_SPREADSHEET_GROUPS = Object.freeze({
  [CONFIG.sheets.settings]: 'main',
  [CONFIG.sheets.products]: 'main',
  [CONFIG.sheets.inventoryHistory]: 'main',
  [CONFIG.sheets.errors]: 'main',
  [CONFIG.sheets.history]: 'main',
  [CONFIG.sheets.completedOrders]: 'dashboard',
  주문: 'main',
  주문상품: 'main',
  [CONFIG.sheets.productRegistration]: 'inbound',
  [CONFIG.sheets.inboundPending]: 'inbound',
  [CONFIG.sheets.inboundCompleted]: 'inbound',
  [CONFIG.sheets.inboundErrors]: 'inbound',
  [CONFIG.sheets.pickingHeaders]: 'picking',
  [CONFIG.sheets.pickingLines]: 'picking',
  [CONFIG.sheets.inventoryDashboard]: 'dashboard',
  [CONFIG.sheets.orderDashboard]: 'dashboard',
  [CONFIG.sheets.pickingDashboard]: 'dashboard',
  [CONFIG.sheets.crossCheckDashboard]: 'dashboard',
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

// 최신 운영 파일과 카페24 내보내기 헤더를 내부 표준 헤더로 바꾼다.
const PRODUCT_IMPORT_HEADER_ALIASES = Object.freeze({
  내부SKU: '코드',
  재고코드: '바코드',
  관리코드: '관리명',
  옵션명: '옵션',
  상품구분: '유형',
  기본보관위치: '로케이션',
  예약재고: '발송대기',
  상품상태: '상품진행여부',
  품목코드: '상품품목코드',
  품목명: '옵션',
  재고수량: '가용재고',
});

const PRODUCT_IGNORED_IMPORT_HEADERS = Object.freeze([
  '상품코드',
  '자체 상품코드',
  '판매가',
  '총 재고량',
  '자체 품목코드',
  '재고관리 사용',
  '등록일',
  '승인자',
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

// 상품마스터 앞쪽은 최신 운영 파일 형식을 따르고, 자동화용 컬럼은 뒤에 보존한다.
const PRODUCT_SHEET_HEADERS = Object.freeze([
  '상품품목코드',
  '내부SKU',
  '재고코드',
  '관리코드',
  '상품명',
  '옵션명',
  '상품구분',
  '이미지',
  '기본보관위치',
  '가용재고',
  '예약재고',
  '불량재고',
  '상품상태',
  '등록일',
  '승인자',
  '고객사명',
  '형태',
  '보관장소',
  '유효기간',
  '안전재고',
  '적정재고',
  '입출고',
  '차트',
  '박스내용',
  '박스수량',
  '출고후잔량',
  '원본파일ID',
  '원본파일명',
  '재고상태',
]);

// 재고를 직접 증감하는 필드와 설정값처럼 덮어쓰는 숫자 필드를 구분한다.
const ADDITIVE_PRODUCT_HEADERS = Object.freeze(['가용재고', '불량재고']);
const SYSTEM_MANAGED_PRODUCT_HEADERS = Object.freeze(['발송대기', '출고후잔량']);

// 재고 변동은 파일 처리 이력과 분리해 상품 단위로 추적한다.
const INVENTORY_HISTORY_HEADERS = Object.freeze([
  '일시',
  '유형',
  '상품품목코드',
  '상품명',
  '옵션',
  '가용재고변화량',
  '발송대기변화량',
  '처리후가용재고',
  '처리후발송대기',
  '관련주문번호',
  '관련품목주문번호',
  '원본파일명',
  '비고',
  '관련작업ID',
]);

// 수동 상품 승인은 재고 수량을 바로 반영하지 않고 입고 작업을 만든다.
const PRODUCT_REGISTRATION_INPUT_HEADERS = Object.freeze([
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
  '로케이션',
  '보관장소',
  '유효기간',
  '상품진행여부',
  '안전재고',
  '적정재고',
  '박스내용',
  '박스수량',
]);

const PRODUCT_REGISTRATION_HEADERS = Object.freeze([
  '등록작업ID',
  ...PRODUCT_REGISTRATION_INPUT_HEADERS,
  '처리상태',
  '실행자',
  '실행시각',
  '오류사유',
]);

const INBOUND_WORK_HEADERS = Object.freeze([
  '입고작업ID',
  '등록작업ID',
  '상품품목코드',
  '코드',
  '고객사명',
  '상품명',
  '관리명',
  '옵션',
  '바코드',
  '입고구분',
  '입고예정일',
  '실제입고일',
  '입고예정수량',
  '실제입고수량',
  '정상수량',
  '불량수량',
  '부족수량',
  '초과수량',
  '로케이션',
  '보관장소',
  '유효기간',
  '처리상태',
  '실행자',
  '실행시각',
  '오류사유',
  '비고',
]);

const PICKING_HEADER_HEADERS = Object.freeze([
  '피킹지시번호',
  '주문번호',
  '카트 슬롯',
  '품목수',
  '총수량',
  '피킹담당자',
  '상태(대기/진행/완료/예외)',
  '생성일시',
  '완료일시',
  '예외사유',
]);

const PICKING_LINE_HEADERS = Object.freeze([
  '순번',
  '보관위치',
  '상품코드',
  '이미지',
  '상품명',
  '옵션',
  '필요수량',
  '확인',
  '실제수량',
  '예외사유',
  '품목별 주문번호',
  '주문번호',
  '피킹지시번호',
  '라인상태',
  '처리일시',
]);

// 시트 표시명은 최신 형식을 사용하되 기존 코드와 과거 시트명도 계속 읽을 수 있게 한다.
const SHEET_HEADER_ALIAS_GROUPS = Object.freeze([
  Object.freeze(['상품품목코드', '상품코드', '품목코드']),
  Object.freeze(['코드', '내부SKU']),
  Object.freeze(['바코드', '재고코드']),
  Object.freeze(['관리명', '관리코드']),
  Object.freeze(['옵션', '옵션명']),
  Object.freeze(['유형', '상품구분']),
  Object.freeze(['로케이션', '기본보관위치', '보관위치']),
  Object.freeze(['발송대기', '예약재고']),
  Object.freeze(['상품진행여부', '상품상태']),
  Object.freeze(['카트슬롯', '카트 슬롯']),
  Object.freeze(['상태', '상태(대기/진행/완료/예외)']),
  Object.freeze(['쇼핑몰 번호', '쇼핑몰번호']),
  Object.freeze(['배송메세지', '배송메시지']),
  Object.freeze(['총주문금액', '총 주문금액(KRW)']),
  Object.freeze(['결제금액', '총 결제금액(KRW)']),
  Object.freeze(['주문상품명', '주문상품명(기본)']),
  Object.freeze(['상품옵션', '상품옵션(기본)']),
  Object.freeze(['수령인 주소', '수령인 주소(전체)']),
  Object.freeze(['등록일시', '등록일']),
]);

function normalizeProductImportHeader_(value) {
  const header = normalizeHeader_(value);
  return PRODUCT_IMPORT_HEADER_ALIASES[header] || header;
}

// 설정 시트에서 사용자 입력을 받을 기본 행이다.
const SETTINGS_SHEET_ROWS = Object.freeze([
  ['입력 트리거 분', '30', '상품/주문 공통. 허용값: 1, 5, 10, 15, 30'],
  ['운영 요일', '월,화,수,목,금', '쉼표로 구분. 예: 월,화,수,목,금 또는 매일'],
  ['운영 시작 시간', '09:00', '24시간 형식 HH:mm 예: 09:00'],
  ['운영 종료 시간', '18:00', '24시간 형식 HH:mm 예: 18:00'],
  ['백업 메일 주소', '', '백업 파일을 받을 이메일 주소 (예: user@example.com)'],
  ['백업 대상 시트', '상품마스터', '쉼표로 구분한 시트명 예: 상품마스터,주문,주문상품'],
  ['백업 요일', '금', '쉼표로 구분. 예: 수,금 또는 매일'],
  ['백업 시간', '09:00', '24시간 형식 HH:mm 예: 09:00'],
  ['피킹 담당자', '', '쉼표로 구분. 비우면 미배정'],
  ['담당자별 주문수', '10', '주문 N건마다 담당자 교체'],
  ['피킹 반영 트리거 분', '5', '허용값: 1, 5, 10, 15, 30'],
]);
