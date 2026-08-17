// 상품 CSV 처리 흐름에서 공통으로 사용하는 폴더, 시트, 트리거 설정이다.
const CONFIG = Object.freeze({
  folders: {
    input: 'input',
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
    pickingDashboard: '피킹대시보드',
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
    inputFolderId: 'INPUT_FOLDER_ID',
    errorFolderId: 'ERROR_FOLDER_ID',
    inventoryModelVersion: 'INVENTORY_MODEL_VERSION',
  },
  backupExportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  spreadsheetName: 'polar_fox_logistics',
  triggerHandler: 'scanInputFolder',
  backupTriggerHandler: 'sendConfiguredBackupEmail',
  pickingTriggerHandler: 'syncPickingResults',
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
  '카트슬롯',
  '품목수',
  '총수량',
  '피킹담당자',
  '상태',
  '생성일시',
  '완료일시',
  '예외사유',
]);

const PICKING_LINE_HEADERS = Object.freeze([
  '순번',
  '보관위치',
  '상품품목코드',
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
