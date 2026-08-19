import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ console });

[
  'src/Config.js',
  'src/Order_Config.js',
  'src/CsvValidation.js',
  'src/Order_SheetRepository.js',
  'src/InboundWorkflow.js',
  'src/Setup.js',
  'src/Dashboard.js',
].forEach((filePath) => {
  vm.runInContext(fs.readFileSync(filePath, 'utf8'), context, { filename: filePath });
});

test('운영 시트를 관리자용·업무인원용 두 파일로 분리한다', () => {
  assert.equal(
    vm.runInContext('Object.keys(CONFIG.spreadsheetFiles).join(",")', context),
    'admin,worker',
  );
  assert.equal(
    vm.runInContext('SHEET_SPREADSHEET_GROUPS[CONFIG.sheets.products]', context),
    'admin',
  );
  assert.equal(
    vm.runInContext('SHEET_SPREADSHEET_GROUPS[CONFIG.sheets.inboundPending]', context),
    'worker',
  );
  assert.equal(
    vm.runInContext('SHEET_SPREADSHEET_GROUPS[CONFIG.sheets.pickingLines]', context),
    'worker',
  );
  assert.equal(
    vm.runInContext('SHEET_SPREADSHEET_GROUPS[CONFIG.sheets.crossCheckDashboard]', context),
    'admin',
  );
  assert.equal(
    vm.runInContext('SHEET_SPREADSHEET_GROUPS[CONFIG.sheets.completedOrders]', context),
    'admin',
  );
});

test('교차검증은 파일 간 연결이 끊긴 주문품목과 피킹라인을 찾는다', () => {
  context.__crossCheckRecords = {
    products: [{ 상품품목코드: 'P-1' }],
    orders: [{ 주문번호: 'O-1' }],
    orderItems: [{ 주문번호: 'O-404', '품목별 주문번호': 'I-1', 상품품목코드: 'P-1' }],
    inboundPending: [{ 입고작업ID: 'IN-1', 상품품목코드: 'P-404' }],
    pickingHeaders: [{ 피킹지시번호: 'PK-1', 주문번호: 'O-1' }],
    pickingLines: [
      {
        피킹지시번호: 'PK-404',
        '품목별 주문번호': 'I-404',
        상품품목코드: 'P-404',
      },
    ],
  };
  const model = vm.runInContext('buildCrossCheckModel_(__crossCheckRecords)', context);

  assert.equal(model.issues.length, 5);
  assert.deepEqual(
    [...new Set(model.issues.map((issue) => issue.type))].sort(),
    ['상품 없음', '주문 없음', '주문품목 없음', '피킹헤더 없음'].sort(),
  );
});

test('기존 상품마스터 값을 최신 컬럼으로 헤더 기준 재배치한다', () => {
  context.__sourceHeaders = [
    '상품품목코드',
    '코드',
    '상품명',
    '옵션',
    '로케이션',
    '발송대기',
    '등록일시',
    '재고상태',
  ];
  context.__sourceValues = [
    ['P0001', 'SKU-1', '테스트 상품', '파랑', 'A-01-01', 2, '2026-08-17', '안전재고 부족'],
  ];
  const mapped = vm.runInContext(
    'mapSheetValuesByHeaders_(__sourceHeaders, __sourceValues, PRODUCT_SHEET_HEADERS)',
    context,
  )[0];
  const indexOf = (header) =>
    vm.runInContext(`PRODUCT_SHEET_HEADERS.indexOf(${JSON.stringify(header)})`, context);

  assert.equal(mapped[indexOf('상품품목코드')], 'P0001');
  assert.equal(mapped[indexOf('내부SKU')], 'SKU-1');
  assert.equal(mapped[indexOf('옵션명')], '파랑');
  assert.equal(mapped[indexOf('기본보관위치')], 'A-01-01');
  assert.equal(mapped[indexOf('예약재고')], 2);
  assert.equal(mapped[indexOf('등록일')], '2026-08-17');
  assert.equal(mapped[indexOf('재고상태')], '안전재고 부족');
});
