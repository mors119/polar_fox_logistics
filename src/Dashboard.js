const DASHBOARD_THEME = Object.freeze({
  navy: '#16324F',
  blue: '#1F4E78',
  teal: '#0F766E',
  paleBlue: '#EAF2F8',
  paleGreen: '#E8F5E9',
  paleYellow: '#FFF8E1',
  paleRed: '#FDECEC',
  border: '#CBD5E1',
  text: '#1F2937',
  muted: '#64748B',
  white: '#FFFFFF',
});

function refreshOperationsDashboards() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return refreshOperationsDashboards_();
  } finally {
    lock.releaseLock();
  }
}

function refreshOperationsDashboards_() {
  return {
    inventory: refreshInventoryDashboard_(),
    orders: refreshOrderDashboard_(),
    picking: refreshPickingDashboard_(),
    completedOrders: refreshLatestCompletedOrderView_(),
    crossCheck: refreshCrossCheckDashboard_(),
  };
}

function refreshOperationsDashboardsSafely_() {
  try {
    return refreshOperationsDashboards_();
  } catch (error) {
    console.warn(`운영 대시보드 갱신을 건너뜁니다: ${error.message || String(error)}`);
    return null;
  }
}

function refreshInventoryDashboard_() {
  const records = getSheetRecords_(getSheet_(CONFIG.sheets.products)).filter((record) =>
    normalizeWorkflowText_(record['상품품목코드']),
  );
  const summary = records.reduce(
    (result, record) => {
      const available = Number(record['가용재고'] || 0);
      const pending = Number(record['발송대기'] || 0);
      const defective = Number(record['불량재고'] || 0);
      const remaining = available - pending;
      result.available += available;
      result.pending += pending;
      result.defective += defective;
      if (remaining <= 0) result.outOfStock += 1;
      if (!normalizeWorkflowText_(record['로케이션'])) result.missingLocation += 1;
      return result;
    },
    { available: 0, pending: 0, defective: 0, outOfStock: 0, missingLocation: 0 },
  );
  const lowStocks = records
    .filter((record) => {
      const remaining = Number(record['가용재고'] || 0) - Number(record['발송대기'] || 0);
      const safety = Number(record['안전재고'] || 0);
      return remaining > 0 && remaining <= (safety > 0 ? safety : 3);
    })
    .sort(
      (left, right) =>
        Number(left['가용재고'] || 0) -
        Number(left['발송대기'] || 0) -
        (Number(right['가용재고'] || 0) - Number(right['발송대기'] || 0)),
    );

  renderSummaryDashboard_(getSheet_(CONFIG.sheets.inventoryDashboard), {
    title: '📊  재고 현황',
    subtitle: dashboardUpdatedText_(),
    metrics: [
      ['등록 상품', `${records.length}종`],
      ['가용 재고', summary.available],
      ['예약 재고', summary.pending],
      ['품절', `${summary.outOfStock}종`],
    ],
    summary: `총 보유 ${summary.available + summary.defective}개  ·  불량 ${summary.defective}개  ·  보관위치 미지정 ${summary.missingLocation}종`,
    sectionTitle: '재고 부족  (가용 3개 이하 또는 안전재고 이하)',
    headers: ['상품코드', '상품명', '옵션', '위치', '가용', '예약', '출고후잔량', '상태'],
    rows: lowStocks.map((record) => {
      const available = Number(record['가용재고'] || 0);
      const pending = Number(record['발송대기'] || 0);
      return [
        record['상품품목코드'],
        record['상품명'],
        record['옵션'],
        record['로케이션'],
        available,
        pending,
        available - pending,
        record['재고상태'],
      ];
    }),
    tabColor: DASHBOARD_THEME.teal,
  });
  return { productCount: records.length, lowStockCount: lowStocks.length, ...summary };
}

function refreshOrderDashboard_() {
  const orders = getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orders)).filter((record) =>
    normalizeWorkflowText_(record['주문번호']),
  );
  const orderItems = getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orderItems));
  const itemCounts = orderItems.reduce((result, record) => {
    const orderNumber = normalizeWorkflowText_(record['주문번호']);
    if (orderNumber) result[orderNumber] = (result[orderNumber] || 0) + 1;
    return result;
  }, {});
  const countStatus = (statuses) =>
    orders.filter((record) => statuses.includes(normalizeWorkflowText_(record['주문상태']))).length;
  const metrics = [
    ['접수', 0],
    ['확정', countStatus(['확정'])],
    [
      '예약대기',
      countStatus([ORDER_CONFIG.defaultOrderStatus, ORDER_CONFIG.partiallyShippedOrderStatus]),
    ],
    ['출고완료', countStatus([ORDER_CONFIG.shippedOrderItemStatus])],
  ];
  metrics[0][1] =
    orders.length -
    metrics.slice(1).reduce((sum, metric) => sum + metric[1], 0) -
    countStatus([ORDER_CONFIG.canceledOrderStatus]);
  const canceled = countStatus([ORDER_CONFIG.canceledOrderStatus]);
  const recentOrders = orders.slice(-20).reverse();

  renderSummaryDashboard_(getSheet_(CONFIG.sheets.orderDashboard), {
    title: '📊  주문 현황',
    subtitle: dashboardUpdatedText_(),
    metrics,
    summary: `취소 ${canceled}건   ·   전체 주문 ${orders.length}건`,
    sectionTitle: '최근 주문',
    headers: [
      '주문번호',
      '쇼핑몰',
      '수령인',
      '품목',
      '주문상태',
      '담당자',
      '피킹지시번호',
      '등록일시',
    ],
    rows: recentOrders.map((record) => [
      record['주문번호'],
      record['쇼핑몰'],
      record['수령인'],
      itemCounts[record['주문번호']] || 0,
      record['주문상태'],
      record['피킹담당자'],
      record['피킹지시번호'],
      record['등록일시'],
    ]),
    tabColor: DASHBOARD_THEME.blue,
  });
  return { orderCount: orders.length, canceledCount: canceled };
}

function refreshLatestCompletedOrderView_() {
  const sheet = getSheet_(CONFIG.sheets.completedOrders);
  const orders = getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orders));
  const items = getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orderItems));
  const ordersByNumber = orders.reduce((result, record) => {
    const orderNumber = normalizeWorkflowText_(record['주문번호']);
    if (orderNumber) result[orderNumber] = record;
    return result;
  }, {});
  const rows = items
    .filter((item) => normalizeWorkflowText_(item['주문번호']))
    .map((item) => {
      const order = ordersByNumber[normalizeWorkflowText_(item['주문번호'])] || {};
      return [
        order['쇼핑몰'],
        order['쇼핑몰 번호'],
        item['주문번호'],
        item['품목별 주문번호'],
        order['배송메세지'],
        order['총주문금액'],
        order['결제금액'],
        item['상품품목코드'],
        item['주문상품명'],
        item['상품옵션'],
        Number(item['수량'] || 0),
        item['판매가'],
        order['수령인'],
        order['수령인 휴대전화'],
        order['수령인 우편번호'],
        order['수령인 주소'],
        normalizeWorkflowText_(item['처리상태']) === ORDER_CONFIG.shippedOrderItemStatus,
        order['피킹지시번호'],
        order['주문상태'],
        order['취소사유'],
        order['취소일시'],
      ];
    });

  sheet.clearContents();
  sheet
    .getRange(1, 1, 1, LATEST_COMPLETED_ORDER_HEADERS.length)
    .setValues([LATEST_COMPLETED_ORDER_HEADERS]);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, LATEST_COMPLETED_ORDER_HEADERS.length).setValues(rows);
    const shippedRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    sheet.getRange(2, 17, rows.length, 1).setDataValidation(shippedRule);
  }
  styleLatestCompletedOrderView_(sheet, rows.length);
  return { rowCount: rows.length };
}

function refreshCrossCheckDashboard_() {
  const model = buildCrossCheckModel_({
    products: getSheetRecords_(getSheet_(CONFIG.sheets.products)),
    orders: getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orders)),
    orderItems: getSheetRecords_(getSheet_(ORDER_CONFIG.sheets.orderItems)),
    inboundPending: getSheetRecords_(getSheet_(CONFIG.sheets.inboundPending)),
    pickingHeaders: getSheetRecords_(getSheet_(CONFIG.sheets.pickingHeaders)),
    pickingLines: getSheetRecords_(getSheet_(CONFIG.sheets.pickingLines)),
  });
  const files = ['admin', 'worker'].map((group) => {
    const spreadsheet = getSpreadsheetByGroup_(group);
    return [group, spreadsheet.getName(), spreadsheet.getUrl()];
  });
  renderCrossCheckDashboard_(getSheet_(CONFIG.sheets.crossCheckDashboard), model, files);
  return { issueCount: model.issues.length, counts: model.counts };
}

function buildCrossCheckModel_(records) {
  const keySet = (rows, header) =>
    new Set((rows || []).map((row) => normalizeWorkflowText_(row[header])).filter(Boolean));
  const productCodes = keySet(records.products, '상품품목코드');
  const orderNumbers = keySet(records.orders, '주문번호');
  const orderItemNumbers = keySet(records.orderItems, '품목별 주문번호');
  const pickingInstructionNumbers = keySet(records.pickingHeaders, '피킹지시번호');
  const issues = [];
  const addIssue = (type, source, key, detail) =>
    issues.push({ type, source, key: normalizeWorkflowText_(key), detail });

  (records.orderItems || []).forEach((row) => {
    const orderNumber = normalizeWorkflowText_(row['주문번호']);
    const itemNumber = normalizeWorkflowText_(row['품목별 주문번호']);
    const productCode = normalizeWorkflowText_(row['상품품목코드']);
    if (orderNumber && !orderNumbers.has(orderNumber)) {
      addIssue('주문 없음', '주문상품', itemNumber || orderNumber, `주문번호 ${orderNumber}`);
    }
    if (productCode && !productCodes.has(productCode)) {
      addIssue('상품 없음', '주문상품', itemNumber || productCode, `상품코드 ${productCode}`);
    }
  });

  (records.pickingHeaders || []).forEach((row) => {
    const instructionNumber = normalizeWorkflowText_(row['피킹지시번호']);
    const orderNumber = normalizeWorkflowText_(row['주문번호']);
    if (orderNumber && !orderNumbers.has(orderNumber)) {
      addIssue(
        '주문 없음',
        '피킹헤더',
        instructionNumber || orderNumber,
        `주문번호 ${orderNumber}`,
      );
    }
  });

  (records.pickingLines || []).forEach((row) => {
    const instructionNumber = normalizeWorkflowText_(row['피킹지시번호']);
    const itemNumber = normalizeWorkflowText_(row['품목별 주문번호']);
    const productCode = normalizeWorkflowText_(row['상품품목코드']);
    if (instructionNumber && !pickingInstructionNumbers.has(instructionNumber)) {
      addIssue('피킹헤더 없음', '피킹라인', itemNumber || instructionNumber, instructionNumber);
    }
    if (itemNumber && !orderItemNumbers.has(itemNumber)) {
      addIssue('주문품목 없음', '피킹라인', itemNumber, `품목별 주문번호 ${itemNumber}`);
    }
    if (productCode && !productCodes.has(productCode)) {
      addIssue('상품 없음', '피킹라인', itemNumber || productCode, `상품코드 ${productCode}`);
    }
  });

  (records.inboundPending || []).forEach((row) => {
    const workId = normalizeWorkflowText_(row['입고작업ID']);
    const productCode = normalizeWorkflowText_(row['상품품목코드']);
    if (productCode && !productCodes.has(productCode)) {
      addIssue('상품 없음', '대기작업', workId || productCode, `상품코드 ${productCode}`);
    }
  });

  return {
    issues,
    counts: {
      products: productCodes.size,
      orders: orderNumbers.size,
      orderItems: orderItemNumbers.size,
      pickingHeaders: pickingInstructionNumbers.size,
      pickingLines: (records.pickingLines || []).length,
      inboundPending: (records.inboundPending || []).length,
    },
  };
}

function renderCrossCheckDashboard_(sheet, model, files) {
  const metricsHeaderRow = 5 + files.length;
  const metricsValueRow = metricsHeaderRow + 1;
  const resultHeaderRow = metricsHeaderRow + 3;
  const resultStartRow = resultHeaderRow + 1;
  const issueRows =
    model.issues.length > 0
      ? model.issues.map((issue) => [issue.type, issue.source, issue.key, issue.detail])
      : [['정상', '전체', '-', '교차검증에서 불일치가 발견되지 않았습니다.']];
  const rows = [
    ['🔗  파일 연결 및 교차검증', '', '', ''],
    [dashboardUpdatedText_(), '', '', ''],
    ['구분', '파일명', '바로가기', '역할'],
    ...files.map(([group, name, url]) => [
      group,
      name,
      `=HYPERLINK("${url}","열기")`,
      crossCheckGroupRole_(group),
    ]),
    ['', '', '', ''],
    ['상품', '주문', '주문품목', '불일치'],
    [model.counts.products, model.counts.orders, model.counts.orderItems, model.issues.length],
    ['', '', '', ''],
    ['검증결과', '원본 시트', '기준키', '상세'],
    ...issueRows,
  ];

  resetDashboardSheet_(sheet);
  sheet.getRange(1, 1, rows.length, 4).setValues(rows);
  sheet.getRange('A1:D1').merge();
  sheet.getRange('A2:D2').merge();
  sheet.setHiddenGridlines(true).setFrozenRows(2).setTabColor('#7C3AED');
  sheet.getRange(1, 1, rows.length, 4).setFontFamily('Arial').setFontColor(DASHBOARD_THEME.text);
  sheet
    .getRange('A1:D1')
    .setBackground(DASHBOARD_THEME.navy)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontSize(18)
    .setFontWeight('bold');
  sheet.getRange('A2:D2').setFontColor(DASHBOARD_THEME.muted);
  [3, resultHeaderRow].forEach((row) =>
    sheet
      .getRange(row, 1, 1, 4)
      .setBackground(DASHBOARD_THEME.blue)
      .setFontColor(DASHBOARD_THEME.white)
      .setFontWeight('bold'),
  );
  sheet
    .getRange(metricsHeaderRow, 1, 1, 4)
    .setBackground(DASHBOARD_THEME.paleBlue)
    .setFontWeight('bold');
  sheet.getRange(metricsValueRow, 1, 1, 4).setFontSize(16).setFontWeight('bold');
  if (model.issues.length > 0) {
    sheet
      .getRange(resultStartRow, 1, model.issues.length, 4)
      .setBackground(DASHBOARD_THEME.paleRed);
  } else {
    sheet.getRange(resultStartRow, 1, 1, 4).setBackground(DASHBOARD_THEME.paleGreen);
  }
  [145, 260, 170, 420].forEach((width, index) => sheet.setColumnWidth(index + 1, width));
}

function crossCheckGroupRole_(group) {
  return {
    admin: '원본·설정·대시보드',
    worker: '상품 등록·입고·피킹 작업',
  }[group];
}

function styleLatestCompletedOrderView_(sheet, rowCount) {
  sheet.setFrozenRows(1);
  sheet.setFrozenColumns(4);
  sheet.setTabColor(DASHBOARD_THEME.blue);
  sheet
    .getRange(1, 1, 1, LATEST_COMPLETED_ORDER_HEADERS.length)
    .setBackground(DASHBOARD_THEME.navy)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.setRowHeight(1, 32);
  if (rowCount > 0) {
    sheet
      .getRange(2, 1, rowCount, LATEST_COMPLETED_ORDER_HEADERS.length)
      .setVerticalAlignment('middle');
    sheet.getRange(2, 3, rowCount, 2).setNumberFormat('@');
    sheet.getRange(2, 8, rowCount, 1).setNumberFormat('@');
    sheet.getRange(2, 15, rowCount, 1).setNumberFormat('@');
    sheet.getRange(2, 6, rowCount, 2).setNumberFormat('#,##0');
    sheet.getRange(2, 11, rowCount, 2).setNumberFormat('#,##0');
    sheet.getRange(2, 21, rowCount, 1).setNumberFormat('yyyy-mm-dd hh:mm');
  }
  [
    100, 95, 155, 185, 190, 130, 130, 145, 280, 140, 70, 100, 100, 140, 110, 320, 85, 150, 110, 160,
    145,
  ].forEach((width, index) => sheet.setColumnWidth(index + 1, width));
}

function renderSummaryDashboard_(sheet, model) {
  const width = 8;
  const rows = [
    [model.title],
    [model.subtitle],
    model.metrics.flatMap((metric) => [metric[0], '']),
    model.metrics.flatMap((metric) => [metric[1], '']),
    [model.summary],
    [],
    [model.sectionTitle],
    model.headers,
    ...model.rows,
  ].map((row) => [...row, ...Array(Math.max(width - row.length, 0)).fill('')].slice(0, width));

  resetDashboardSheet_(sheet);
  sheet.getRange(1, 1, rows.length, width).setValues(rows);
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A2:H2').merge();
  sheet.getRange('A5:H5').merge();
  sheet.getRange('A7:H7').merge();
  ['A3:B3', 'C3:D3', 'E3:F3', 'G3:H3', 'A4:B4', 'C4:D4', 'E4:F4', 'G4:H4'].forEach((range) =>
    sheet.getRange(range).merge(),
  );
  styleSummaryDashboard_(sheet, rows.length, model.tabColor);
}

function resetDashboardSheet_(sheet) {
  const dataRange = sheet.getDataRange();
  if (dataRange) dataRange.breakApart();
  sheet.clear();
}

function styleSummaryDashboard_(sheet, rowCount, tabColor) {
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);
  sheet.setTabColor(tabColor);
  sheet.getRange(1, 1, rowCount, 8).setFontFamily('Arial').setFontColor(DASHBOARD_THEME.text);
  sheet
    .getRange('A1:H1')
    .setBackground(DASHBOARD_THEME.navy)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontSize(18)
    .setFontWeight('bold')
    .setVerticalAlignment('middle');
  sheet.getRange('A2:H2').setFontColor(DASHBOARD_THEME.muted).setFontSize(10);
  sheet
    .getRange('A3:H3')
    .setBackground(DASHBOARD_THEME.blue)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet
    .getRange('A4:H4')
    .setBackground(DASHBOARD_THEME.paleBlue)
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A5:H5').setBackground('#F8FAFC').setFontColor(DASHBOARD_THEME.muted);
  sheet
    .getRange('A7:H7')
    .setBackground(DASHBOARD_THEME.teal)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold');
  sheet
    .getRange('A8:H8')
    .setBackground(DASHBOARD_THEME.paleBlue)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  if (rowCount > 8) {
    sheet
      .getRange(8, 1, rowCount - 7, 8)
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        DASHBOARD_THEME.border,
        SpreadsheetApp.BorderStyle.SOLID,
      );
    for (let row = 9; row <= rowCount; row += 1) {
      if (row % 2 === 1) sheet.getRange(row, 1, 1, 8).setBackground('#F8FAFC');
    }
  }
  [110, 260, 110, 100, 100, 110, 140, 145].forEach((width, index) =>
    sheet.setColumnWidth(index + 1, width),
  );
  sheet.setRowHeight(1, 36);
  sheet.setRowHeight(2, 24);
  sheet.setRowHeights(3, 2, 32);
}

function stylePickingDashboard_(sheet, rowCount, lowStockHeaderRow) {
  sheet.setHiddenGridlines(true);
  sheet.setFrozenRows(2);
  sheet.setTabColor('#F59E0B');
  sheet.getRange(1, 1, rowCount, 8).setFontFamily('Arial').setFontColor(DASHBOARD_THEME.text);
  sheet.getRange('A1:H1').merge();
  sheet.getRange('A2:H2').merge();
  ['A3:B3', 'C3:D3', 'E3:F3', 'G3:H3', 'A4:B4', 'C4:D4', 'E4:F4', 'G4:H4'].forEach((range) =>
    sheet.getRange(range).merge(),
  );
  sheet.getRange('B5:H5').merge();
  sheet.getRange('A7:H7').merge();
  sheet.getRange(lowStockHeaderRow - 1, 1, 1, 8).merge();
  sheet
    .getRange('A1:H1')
    .setBackground(DASHBOARD_THEME.navy)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontSize(18)
    .setFontWeight('bold');
  sheet.getRange('A2:H2').setFontColor(DASHBOARD_THEME.muted).setFontSize(10);
  sheet
    .getRange('A3:H3')
    .setBackground(DASHBOARD_THEME.blue)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet
    .getRange('A4:H4')
    .setBackground(DASHBOARD_THEME.paleBlue)
    .setFontSize(16)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A5:H5').setBackground('#F8FAFC').setFontWeight('bold');
  sheet
    .getRange('A7:H7')
    .setBackground(DASHBOARD_THEME.teal)
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold');
  sheet.getRange('A8:H8').setBackground(DASHBOARD_THEME.paleBlue).setFontWeight('bold');
  sheet
    .getRange(lowStockHeaderRow - 1, 1, 1, 8)
    .setBackground('#B45309')
    .setFontColor(DASHBOARD_THEME.white)
    .setFontWeight('bold');
  sheet
    .getRange(lowStockHeaderRow, 1, 1, 8)
    .setBackground(DASHBOARD_THEME.paleYellow)
    .setFontWeight('bold');
  if (lowStockHeaderRow > 8) {
    sheet
      .getRange(8, 1, lowStockHeaderRow - 8, 8)
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        DASHBOARD_THEME.border,
        SpreadsheetApp.BorderStyle.SOLID,
      );
  }
  if (rowCount >= lowStockHeaderRow) {
    sheet
      .getRange(lowStockHeaderRow, 1, rowCount - lowStockHeaderRow + 1, 8)
      .setBorder(
        true,
        true,
        true,
        true,
        true,
        true,
        DASHBOARD_THEME.border,
        SpreadsheetApp.BorderStyle.SOLID,
      );
  }
  [80, 175, 110, 75, 75, 190, 100, 190].forEach((width, index) =>
    sheet.setColumnWidth(index + 1, width),
  );
  sheet.setRowHeight(1, 36);
  sheet.setRowHeight(2, 24);
  sheet.setRowHeights(3, 2, 32);
}

function applyOperationsSheetUi_(spreadsheet) {
  const tableSheets = [
    CONFIG.sheets.products,
    ORDER_CONFIG.sheets.orders,
    ORDER_CONFIG.sheets.orderItems,
    CONFIG.sheets.completedOrders,
    CONFIG.sheets.productRegistration,
    CONFIG.sheets.inboundPending,
    CONFIG.sheets.inboundCompleted,
    CONFIG.sheets.inboundErrors,
    CONFIG.sheets.pickingHeaders,
    CONFIG.sheets.pickingLines,
    CONFIG.sheets.inventoryHistory,
    CONFIG.sheets.errors,
    CONFIG.sheets.history,
  ];
  tableSheets.forEach((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastColumn() === 0) return;
    sheet.setFrozenRows(1);
    sheet.setHiddenGridlines(false);
    sheet
      .getRange(1, 1, 1, sheet.getLastColumn())
      .setBackground(DASHBOARD_THEME.navy)
      .setFontColor(DASHBOARD_THEME.white)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 32);
    sheet.setTabColor(
      sheetName === CONFIG.sheets.inboundErrors || sheetName === CONFIG.sheets.errors
        ? '#C62828'
        : DASHBOARD_THEME.blue,
    );
  });
  applyLatestColumnWidths_(spreadsheet);
  const productSheet = spreadsheet.getSheetByName(CONFIG.sheets.products);
  if (productSheet && productSheet.getMaxColumns() >= 15) {
    productSheet.showColumns(1, 15);
    if (productSheet.getLastColumn() > 15) {
      productSheet.hideColumns(16, productSheet.getLastColumn() - 15);
    }
  }
}

function applyLatestColumnWidths_(spreadsheet) {
  const widthByHeader = {
    상품품목코드: 145,
    상품코드: 145,
    내부SKU: 145,
    재고코드: 110,
    관리코드: 110,
    상품명: 280,
    옵션명: 130,
    기본보관위치: 120,
    주문상품명: 280,
    옵션: 130,
    주문번호: 155,
    '품목별 주문번호': 185,
    보관위치: 110,
    로케이션: 110,
    예외사유: 160,
    처리상태: 120,
    '상태(대기/진행/완료/예외)': 170,
  };
  spreadsheet.getSheets().forEach((sheet) => {
    if (sheet.getLastColumn() === 0) return;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    headers.forEach((header, index) => {
      const width = widthByHeader[normalizeHeader_(header)];
      if (width) sheet.setColumnWidth(index + 1, width);
    });
  });
}

function dashboardUpdatedText_() {
  return `갱신 ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MM-dd HH:mm')}`;
}

function buildDashboardProgressBar_(percentage, length) {
  const safePercentage = Math.max(0, Math.min(Number(percentage) || 0, 100));
  const filled = Math.round((safePercentage / 100) * length);
  return `${'█'.repeat(filled)}${'░'.repeat(length - filled)}`;
}
