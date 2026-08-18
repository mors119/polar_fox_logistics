const PICKING_STATUS = Object.freeze({
  waiting: '대기',
  inProgress: '진행',
  completed: '완료',
  exception: '예외',
  lineWaiting: '미처리',
  deducted: '차감완료',
  restored: '복원완료',
  canceled: '취소마감',
  reasonRequired: '사유입력필요',
});

// 미출고 주문을 카트 슬롯과 담당자별로 묶고 로케이션 순서의 피킹 라인을 만든다.
function createPickingInstruction() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const orderSheet = getSheet_(ORDER_CONFIG.sheets.orders);
    const itemSheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
    const headerSheet = getSheet_(CONFIG.sheets.pickingHeaders);
    const lineSheet = getSheet_(CONFIG.sheets.pickingLines);
    const productMap = getExistingProductMap_(getSheet_(CONFIG.sheets.products));
    const settings = getSettingsMap_();
    const assignees = parsePickingAssignees_(settings[CONFIG.settingsKeys.pickingAssignees]);
    const assignmentUnit = parsePickingAssignmentUnit_(
      settings[CONFIG.settingsKeys.pickingAssignmentUnit],
    );
    const existingPickingOrders = new Set(
      getSheetRecords_(headerSheet).map((record) => normalizeWorkflowText_(record['주문번호'])),
    );
    const itemGroups = groupSheetItemsByOrder_(getSheetRecordsWithRows_(itemSheet));
    const eligibleOrders = getSheetRecordsWithRows_(orderSheet).filter((item) => {
      const record = item.record;
      const items = itemGroups[normalizeWorkflowText_(record['주문번호'])] || [];
      return (
        normalizeWorkflowText_(record['주문상태']) === ORDER_CONFIG.defaultOrderStatus &&
        !normalizeWorkflowText_(record['피킹지시번호']) &&
        !existingPickingOrders.has(normalizeWorkflowText_(record['주문번호'])) &&
        items.length > 0 &&
        items.every(
          (orderItem) =>
            normalizeWorkflowText_(orderItem.record['처리상태']) ===
            ORDER_CONFIG.defaultOrderItemStatus,
        )
      );
    });

    if (eligibleOrders.length === 0) {
      return { instructionId: '', orderCount: 0, lineCount: 0, skippedOrders: [] };
    }

    const instructionId = createPickingInstructionId_(headerSheet);
    const now = new Date();
    const headerRows = [];
    const lineRows = [];
    const acceptedOrders = [];
    const skippedOrders = [];
    const plannedAvailableStock = {};

    eligibleOrders.forEach((orderItem) => {
      const orderNumber = normalizeWorkflowText_(orderItem.record['주문번호']);
      const orderLines = itemGroups[orderNumber] || [];
      const stockPlan = buildPickingStockPlan_(orderLines, productMap, plannedAvailableStock);
      if (!stockPlan.eligible) {
        skippedOrders.push({
          orderNumber,
          reason: stockPlan.reason,
        });
        return;
      }

      const slot = acceptedOrders.length + 1;
      const assignee = selectPickingAssignee_(assignees, slot, assignmentUnit);
      const recipient = normalizeWorkflowText_(orderItem.record['수령인']);
      const orderGroup = `🛒 ${String(slot).padStart(2, '0')} · ${recipient || '수령인 미입력'} · ${orderNumber}`;
      const sortedLines = orderLines.slice().sort((left, right) => {
        const leftProduct = productMap[normalizeWorkflowText_(left.record['상품품목코드'])].record;
        const rightProduct =
          productMap[normalizeWorkflowText_(right.record['상품품목코드'])].record;
        return normalizeWorkflowText_(leftProduct['로케이션']).localeCompare(
          normalizeWorkflowText_(rightProduct['로케이션']),
        );
      });
      const totalQuantity = sortedLines.reduce(
        (sum, line) => sum + Number(line.record['수량'] || 0),
        0,
      );

      headerRows.push([
        instructionId,
        slot,
        orderNumber,
        recipient,
        sortedLines.length,
        totalQuantity,
        assignee,
        PICKING_STATUS.waiting,
        now,
        '',
        '',
      ]);
      const remainingStock = Object.keys(stockPlan.stockByProduct).reduce((result, code) => {
        result[code] = stockPlan.stockByProduct[code].availableStock;
        return result;
      }, {});
      sortedLines.forEach((line, index) => {
        const productCode = normalizeWorkflowText_(line.record['상품품목코드']);
        const product = productMap[productCode].record;
        const requiredQuantity = Number(line.record['수량'] || 0);
        const currentStock = remainingStock[productCode];
        const afterShipmentStock = currentStock - requiredQuantity;
        remainingStock[productCode] = afterShipmentStock;
        lineRows.push([
          orderGroup,
          index + 1,
          normalizeWorkflowText_(product['로케이션']),
          productCode,
          buildPickingImageValue_(product['이미지']),
          normalizeWorkflowText_(product['상품명']) ||
            normalizeWorkflowText_(line.record['주문상품명']),
          normalizeWorkflowText_(product['옵션']) ||
            normalizeWorkflowText_(line.record['상품옵션']),
          requiredQuantity,
          currentStock,
          afterShipmentStock,
          '',
          '',
          '',
          normalizeWorkflowText_(line.record['품목별 주문번호']),
          orderNumber,
          instructionId,
          PICKING_STATUS.lineWaiting,
          '',
        ]);
      });
      Object.keys(remainingStock).forEach((productCode) => {
        plannedAvailableStock[productCode] = remainingStock[productCode];
      });
      acceptedOrders.push({ rowNumber: orderItem.rowNumber, orderNumber, assignee });
    });

    if (acceptedOrders.length === 0) {
      return { instructionId: '', orderCount: 0, lineCount: 0, skippedOrders };
    }

    const headerWrite = appendRowsToSheet_(headerSheet, headerRows);
    const lineWrite = appendRowsToSheet_(lineSheet, lineRows);
    const orderHeaderMap = getHeaderIndexMap_(orderSheet);
    try {
      acceptedOrders.forEach((order) => {
        setSheetCellByHeader_(
          orderSheet,
          order.rowNumber,
          orderHeaderMap,
          '피킹지시번호',
          instructionId,
        );
        setSheetCellByHeader_(
          orderSheet,
          order.rowNumber,
          orderHeaderMap,
          '피킹담당자',
          order.assignee,
        );
      });
      applyPickingWorkSheetUi_(headerSheet, lineSheet);
    } catch (error) {
      if (lineWrite.rowCount) lineSheet.deleteRows(lineWrite.startRow, lineWrite.rowCount);
      if (headerWrite.rowCount) headerSheet.deleteRows(headerWrite.startRow, headerWrite.rowCount);
      throw error;
    }

    refreshOperationsDashboardsSafely_();
    return {
      instructionId,
      orderCount: acceptedOrders.length,
      lineCount: lineRows.length,
      skippedOrders,
    };
  } finally {
    lock.releaseLock();
  }
}

// 피킹 지시 직전에 주문 전체를 묶어 실물 재고로 출고 가능한지 다시 확인한다.
function buildPickingStockPlan_(orderLines, productMap, stockBudget) {
  const requestedByProduct = {};

  for (let index = 0; index < orderLines.length; index += 1) {
    const record = orderLines[index].record || {};
    const productCode = normalizeWorkflowText_(record['상품품목코드']);
    const quantity = Number(record['수량'] || 0);
    if (!productCode || !productMap[productCode]) {
      return {
        eligible: false,
        reason: `상품마스터 미등록: ${productCode || '상품코드 없음'}`,
        stockByProduct: {},
      };
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return {
        eligible: false,
        reason: `잘못된 피킹 수량: ${productCode}`,
        stockByProduct: {},
      };
    }
    requestedByProduct[productCode] = (requestedByProduct[productCode] || 0) + quantity;
  }

  const stockByProduct = {};
  const productCodes = Object.keys(requestedByProduct);
  for (let index = 0; index < productCodes.length; index += 1) {
    const productCode = productCodes[index];
    const product = productMap[productCode].record;
    const physicalStock = Number(getRecordValueByAliases_(product, '가용재고') || 0);
    const availableStock =
      stockBudget && Object.prototype.hasOwnProperty.call(stockBudget, productCode)
        ? Number(stockBudget[productCode])
        : physicalStock;
    const requestedQuantity = requestedByProduct[productCode];
    if (!Number.isFinite(availableStock) || availableStock < requestedQuantity) {
      return {
        eligible: false,
        reason: `재고 부족: ${productCode} 필요 ${requestedQuantity} / 현재 ${Number.isFinite(availableStock) ? availableStock : 0}`,
        stockByProduct: {},
      };
    }
    stockByProduct[productCode] = { availableStock, requestedQuantity };
  }

  return { eligible: true, reason: '', stockByProduct };
}

function buildPickingImageValue_(value) {
  const imageUrl = normalizeWorkflowText_(value);
  if (!/^https?:\/\//i.test(imageUrl)) return imageUrl;
  return `=IMAGE("${imageUrl.replace(/"/g, '""')}",4,52,52)`;
}

// 같은 주문은 같은 색 블록으로 묶고, 작업에 필요한 열만 앞에 보이게 한다.
function applyPickingWorkSheetUi_(headerSheet, lineSheet) {
  if (headerSheet) {
    headerSheet.setHiddenGridlines(true).setFrozenRows(1);
    const headerLastRow = headerSheet.getLastRow();
    const headerLastColumn = headerSheet.getLastColumn();
    if (headerLastRow > 1) {
      headerSheet
        .getRange(2, 1, headerLastRow - 1, headerLastColumn)
        .setFontFamily('Arial')
        .setVerticalAlignment('middle')
        .setBorder(true, true, true, true, true, true, '#D7E0EA', SpreadsheetApp.BorderStyle.SOLID);
      headerSheet.setRowHeights(2, headerLastRow - 1, 34);
    }
  }
  if (!lineSheet) return;

  lineSheet.setHiddenGridlines(true).setFrozenRows(1).setFrozenColumns(3);
  const lastRow = lineSheet.getLastRow();
  const lastColumn = lineSheet.getLastColumn();
  const headerMap = getHeaderIndexMap_(lineSheet);
  if (lastRow > 1) {
    const dataRange = lineSheet.getRange(2, 1, lastRow - 1, lastColumn);
    dataRange
      .setBackground('#FFFFFF')
      .setFontFamily('Arial')
      .setVerticalAlignment('middle')
      .setWrap(true)
      .setBorder(true, true, true, true, true, true, '#D7E0EA', SpreadsheetApp.BorderStyle.SOLID);
    const orderNumbers = lineSheet
      .getRange(2, headerMap['주문번호'], lastRow - 1, 1)
      .getDisplayValues()
      .flat();
    let previousOrder = '';
    let groupIndex = -1;
    orderNumbers.forEach((orderNumber, index) => {
      const rowNumber = index + 2;
      if (orderNumber !== previousOrder) {
        groupIndex += 1;
        lineSheet
          .getRange(rowNumber, 1, 1, lastColumn)
          .setBorder(
            true,
            null,
            null,
            null,
            null,
            null,
            '#64748B',
            SpreadsheetApp.BorderStyle.SOLID_MEDIUM,
          );
        previousOrder = orderNumber;
      }
      lineSheet
        .getRange(rowNumber, 1, 1, lastColumn)
        .setBackground(groupIndex % 2 === 0 ? '#F8FBFF' : '#F7FAF8');
    });
    lineSheet
      .getRange(2, 1, lastRow - 1, 1)
      .setFontWeight('bold')
      .setFontColor('#1E3A5F');
    ['필요수량', '현재재고', '출고후재고'].forEach((header) => {
      if (headerMap[header]) {
        lineSheet
          .getRange(2, headerMap[header], lastRow - 1, 1)
          .setHorizontalAlignment('center')
          .setNumberFormat('#,##0');
      }
    });
    if (headerMap['확인']) {
      lineSheet
        .getRange(2, headerMap['확인'], lastRow - 1, 1)
        .setBackground('#FFF4CC')
        .setFontWeight('bold')
        .setHorizontalAlignment('center');
    }
    lineSheet.setRowHeights(2, lastRow - 1, 58);
  }

  const widths = {
    주문묶음: 270,
    순번: 55,
    보관위치: 105,
    상품코드: 130,
    이미지: 70,
    상품명: 250,
    옵션: 130,
    필요수량: 85,
    현재재고: 85,
    출고후재고: 95,
    확인: 70,
    실제수량: 85,
    예외사유: 130,
  };
  Object.keys(widths).forEach((header) => {
    if (headerMap[header]) lineSheet.setColumnWidth(headerMap[header], widths[header]);
  });
  lineSheet.showColumns(1, lastColumn);
  if (headerMap['품목별 주문번호']) {
    lineSheet.hideColumns(
      headerMap['품목별 주문번호'],
      lastColumn - headerMap['품목별 주문번호'] + 1,
    );
  }
}

// O/X 결과를 주문 단위로 판정해 전부 O일 때만 출고하고, X면 전체 취소한다.
function syncPickingResults() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { skipped: true };

  try {
    const lineSheet = getSheet_(CONFIG.sheets.pickingLines);
    const headerSheet = getSheet_(CONFIG.sheets.pickingHeaders);
    const lineGroups = groupSheetItemsByOrder_(getSheetRecordsWithRows_(lineSheet));
    let completedOrders = 0;
    let canceledOrders = 0;
    let processedLines = 0;

    getSheetRecordsWithRows_(headerSheet).forEach((headerItem) => {
      const status = normalizeWorkflowText_(headerItem.record['상태']);
      if ([PICKING_STATUS.completed, PICKING_STATUS.exception].includes(status)) return;
      const orderNumber = normalizeWorkflowText_(headerItem.record['주문번호']);
      const lines = lineGroups[orderNumber] || [];
      const hasException = lines.some(
        (line) => normalizePickingConfirmation_(line.record['확인']) === 'X',
      );

      if (hasException) {
        const exceptionLine = lines.find(
          (line) => normalizePickingConfirmation_(line.record['확인']) === 'X',
        );
        const reason = normalizeWorkflowText_(exceptionLine.record['예외사유']);
        if (!reason) {
          setPickingHeaderState_(
            headerSheet,
            headerItem.rowNumber,
            PICKING_STATUS.inProgress,
            '',
            '예외사유 입력 필요',
          );
          setPickingLineState_(
            lineSheet,
            exceptionLine.rowNumber,
            PICKING_STATUS.reasonRequired,
            0,
          );
          return;
        }
        cancelPickingOrder_(orderNumber, lines, reason);
        setPickingHeaderState_(
          headerSheet,
          headerItem.rowNumber,
          PICKING_STATUS.exception,
          new Date(),
          reason,
        );
        canceledOrders += 1;
        return;
      }

      const allConfirmed =
        lines.length > 0 &&
        lines.every((line) => normalizePickingConfirmation_(line.record['확인']) === 'O');
      if (!allConfirmed) {
        const hasProgress = lines.some((line) =>
          normalizePickingConfirmation_(line.record['확인']),
        );
        setPickingHeaderState_(
          headerSheet,
          headerItem.rowNumber,
          hasProgress ? PICKING_STATUS.inProgress : PICKING_STATUS.waiting,
          '',
          '',
        );
        return;
      }

      lines.forEach((line) => {
        if (normalizeWorkflowText_(line.record['라인상태']) === PICKING_STATUS.deducted) return;
        shipPickingLine_(line);
        processedLines += 1;
      });
      setPickingHeaderState_(
        headerSheet,
        headerItem.rowNumber,
        PICKING_STATUS.completed,
        new Date(),
        '',
      );
      completedOrders += 1;
    });

    refreshOperationsDashboardsSafely_();
    return { completedOrders, canceledOrders, processedLines, skipped: false };
  } finally {
    lock.releaseLock();
  }
}

function shipPickingLine_(line) {
  const itemSheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const item = findSheetItem_(itemSheet, '품목별 주문번호', line.record['품목별 주문번호']);
  if (!item) throw new Error(`주문상품을 찾을 수 없습니다: ${line.record['품목별 주문번호']}`);
  const status = normalizeWorkflowText_(item.record['처리상태']);
  if (status !== ORDER_CONFIG.shippedOrderItemStatus) {
    syncOrderItemCheckboxState_(itemSheet, item.rowNumber, true, { allowPicking: true });
    setSheetCellByHeader_(itemSheet, item.rowNumber, getHeaderIndexMap_(itemSheet), '체크', true);
  }
  setPickingLineState_(
    getSheet_(CONFIG.sheets.pickingLines),
    line.rowNumber,
    PICKING_STATUS.deducted,
    Number(line.record['필요수량'] || 0),
  );
}

function cancelPickingOrder_(orderNumber, lines, reason) {
  const itemSheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const orderItems =
    groupSheetItemsByOrder_(getSheetRecordsWithRows_(itemSheet))[orderNumber] || [];

  orderItems.forEach((item) => {
    const status = normalizeWorkflowText_(item.record['처리상태']);
    if (status === ORDER_CONFIG.canceledOrderItemStatus) return;
    cancelOrderItemSafely_(itemSheet, item, orderNumber, reason);
  });

  const lineSheet = getSheet_(CONFIG.sheets.pickingLines);
  lines.forEach((line) => {
    const previousStatus = normalizeWorkflowText_(line.record['라인상태']);
    setPickingLineState_(
      lineSheet,
      line.rowNumber,
      previousStatus === PICKING_STATUS.deducted
        ? PICKING_STATUS.restored
        : PICKING_STATUS.canceled,
      0,
    );
  });

  const orderSheet = getSheet_(ORDER_CONFIG.sheets.orders);
  const order = findSheetItem_(orderSheet, '주문번호', orderNumber);
  if (order) {
    const headerMap = getHeaderIndexMap_(orderSheet);
    setSheetCellByHeader_(
      orderSheet,
      order.rowNumber,
      headerMap,
      '주문상태',
      ORDER_CONFIG.canceledOrderStatus,
    );
    setSheetCellByHeader_(orderSheet, order.rowNumber, headerMap, '취소사유', reason);
    setSheetCellByHeader_(orderSheet, order.rowNumber, headerMap, '취소일시', new Date());
  }
}

function cancelOrderItemSafely_(itemSheet, item, orderNumber, reason) {
  const itemHeaderMap = getHeaderIndexMap_(itemSheet);
  const status = normalizeWorkflowText_(item.record['처리상태']);
  const orderItemNumber = normalizeWorkflowText_(item.record['품목별 주문번호']);
  const productCode = normalizeWorkflowText_(item.record['상품품목코드']);
  const quantity = Number(item.record['수량'] || 0);
  const productSheet = getSheet_(CONFIG.sheets.products);
  const product = getExistingProductMap_(productSheet)[productCode];
  if (!product) throw new Error(`상품마스터에 없는 상품입니다: ${productCode}`);
  const productHeaderMap = getHeaderIndexMap_(productSheet);
  let recovery;

  if (status === ORDER_CONFIG.cancelingOrderItemStatus) {
    recovery = JSON.parse(normalizeWorkflowText_(item.record['처리메모']));
  } else {
    if (
      ![ORDER_CONFIG.defaultOrderItemStatus, ORDER_CONFIG.shippedOrderItemStatus].includes(status)
    ) {
      throw new Error(`취소할 수 없는 주문상품 상태입니다: ${status}`);
    }
    const availableBefore = Number(
      productSheet.getRange(product.rowNumber, productHeaderMap['가용재고']).getValue() || 0,
    );
    const pendingBefore = Number(
      productSheet.getRange(product.rowNumber, productHeaderMap['발송대기']).getValue() || 0,
    );
    const wasShipped = status === ORDER_CONFIG.shippedOrderItemStatus;
    recovery = {
      taskId: `PICK-CANCEL:${orderItemNumber}`,
      availableBefore,
      pendingBefore,
      availableAfter: wasShipped ? availableBefore + quantity : availableBefore,
      pendingAfter: wasShipped ? pendingBefore : pendingBefore - quantity,
    };
    if (recovery.pendingAfter < 0) {
      throw new Error(`취소 후 발송대기가 음수가 됩니다: ${productCode}`);
    }
    setSheetCellByHeader_(
      itemSheet,
      item.rowNumber,
      itemHeaderMap,
      '처리상태',
      ORDER_CONFIG.cancelingOrderItemStatus,
    );
    setSheetCellByHeader_(
      itemSheet,
      item.rowNumber,
      itemHeaderMap,
      '처리메모',
      JSON.stringify(recovery),
    );
    SpreadsheetApp.flush();
  }

  const current = {
    available: Number(
      productSheet.getRange(product.rowNumber, productHeaderMap['가용재고']).getValue() || 0,
    ),
    pending: Number(
      productSheet.getRange(product.rowNumber, productHeaderMap['발송대기']).getValue() || 0,
    ),
  };
  const recoveryState = classifyPickingCancellationRecovery_(current, recovery);
  if (recoveryState === 'ambiguous') {
    throw new Error(`취소 복구 기준과 현재 재고가 다릅니다: ${productCode}`);
  }
  if (recoveryState === 'before') {
    productSheet
      .getRange(product.rowNumber, productHeaderMap['가용재고'])
      .setValue(recovery.availableAfter);
    productSheet
      .getRange(product.rowNumber, productHeaderMap['발송대기'])
      .setValue(recovery.pendingAfter);
    updateProductInventoryIndicators_(productSheet, product.rowNumber, productHeaderMap, {
      availableStock: recovery.availableAfter,
      pendingStock: recovery.pendingAfter,
      safetyStock: Number(
        productSheet.getRange(product.rowNumber, productHeaderMap['안전재고']).getValue() || 0,
      ),
    });
  }

  if (!inventoryHistoryHasTask_(recovery.taskId)) {
    appendInventoryHistory_([
      {
        type: '주문취소',
        productCode,
        productName: normalizeWorkflowText_(product.record['상품명']),
        option: normalizeWorkflowText_(product.record['옵션']),
        availableDelta: recovery.availableAfter - recovery.availableBefore,
        pendingDelta: recovery.pendingAfter - recovery.pendingBefore,
        availableAfter: recovery.availableAfter,
        pendingAfter: recovery.pendingAfter,
        orderNumber,
        orderItemNumber,
        note: reason,
        taskId: recovery.taskId,
      },
    ]);
  }
  setSheetCellByHeader_(itemSheet, item.rowNumber, itemHeaderMap, '체크', false);
  setSheetCellByHeader_(
    itemSheet,
    item.rowNumber,
    itemHeaderMap,
    '처리상태',
    ORDER_CONFIG.canceledOrderItemStatus,
  );
  setSheetCellByHeader_(itemSheet, item.rowNumber, itemHeaderMap, '처리메모', '');
}

function classifyPickingCancellationRecovery_(current, recovery) {
  const isBefore =
    Number(current.available) === Number(recovery.availableBefore) &&
    Number(current.pending) === Number(recovery.pendingBefore);
  const isAfter =
    Number(current.available) === Number(recovery.availableAfter) &&
    Number(current.pending) === Number(recovery.pendingAfter);
  if (isAfter) return 'after';
  if (isBefore) return 'before';
  return 'ambiguous';
}

function refreshPickingDashboard_() {
  const sheet = getSheet_(CONFIG.sheets.pickingDashboard);
  const headers = getSheetRecords_(getSheet_(CONFIG.sheets.pickingHeaders));
  const lines = getSheetRecords_(getSheet_(CONFIG.sheets.pickingLines));
  const latestInstruction = headers.length
    ? normalizeWorkflowText_(headers[headers.length - 1]['피킹지시번호'])
    : '';
  const currentHeaders = headers.filter(
    (record) => normalizeWorkflowText_(record['피킹지시번호']) === latestInstruction,
  );
  const currentLines = lines.filter(
    (record) => normalizeWorkflowText_(record['피킹지시번호']) === latestInstruction,
  );
  const statusCounts = countPickingStatuses_(currentHeaders);
  const processedCount = currentLines.filter((record) =>
    [PICKING_STATUS.deducted, PICKING_STATUS.restored, PICKING_STATUS.canceled].includes(
      normalizeWorkflowText_(record['라인상태']),
    ),
  ).length;
  const progress = currentLines.length
    ? Math.round((processedCount / currentLines.length) * 100)
    : 0;
  const productRecords = getSheetRecords_(getSheet_(CONFIG.sheets.products));
  const lowStocks = productRecords.filter((record) => {
    const remaining = Number(record['가용재고'] || 0) - Number(record['발송대기'] || 0);
    const safety = Number(record['안전재고'] || 0);
    return remaining <= (safety > 0 ? safety : 3);
  });

  const slotRows = currentHeaders.map((record) => {
    const orderNumber = normalizeWorkflowText_(record['주문번호']);
    const orderLines = currentLines.filter(
      (line) => normalizeWorkflowText_(line['주문번호']) === orderNumber,
    );
    const completedLines = orderLines.filter((line) =>
      [PICKING_STATUS.deducted, PICKING_STATUS.restored, PICKING_STATUS.canceled].includes(
        normalizeWorkflowText_(line['라인상태']),
      ),
    ).length;
    const orderProgress = orderLines.length
      ? Math.round((completedLines / orderLines.length) * 100)
      : 0;
    return [
      record['카트슬롯'],
      orderNumber,
      record['피킹담당자'],
      record['품목수'],
      record['총수량'],
      `${buildDashboardProgressBar_(orderProgress, 8)} ${orderProgress}%`,
      record['상태'],
      record['예외사유'],
    ];
  });
  resetDashboardSheet_(sheet);
  const rows = [
    ['📦  피킹 현황'],
    [`${dashboardUpdatedText_()}     ·     현재 지시  ${latestInstruction || '없음'}`],
    ['대기', '', '진행 중', '', '완료', '', '취소', ''],
    [
      statusCounts[PICKING_STATUS.waiting],
      '',
      statusCounts[PICKING_STATUS.inProgress],
      '',
      statusCounts[PICKING_STATUS.completed],
      '',
      statusCounts[PICKING_STATUS.exception],
      '',
    ],
    [
      '전체 진행률',
      `${buildDashboardProgressBar_(progress, 20)}   ${progress}%   (${processedCount} / ${currentLines.length} 품목)`,
    ],
    [],
    ['슬롯별 현황'],
    ['슬롯', '주문번호', '담당자', '품목', '수량', '진행', '상태', '비고'],
    ...slotRows,
    [],
    ['⚠ 안전재고 확인'],
    ['상품코드', '상품명', '옵션', '위치', '가용', '예약', '출고후잔량', '안전재고'],
    ...lowStocks.map((record) => [
      record['상품품목코드'],
      record['상품명'],
      record['옵션'],
      record['로케이션'],
      record['가용재고'],
      record['발송대기'],
      Number(record['가용재고'] || 0) - Number(record['발송대기'] || 0),
      record['안전재고'],
    ]),
  ];
  const width = Math.max(...rows.map((row) => row.length), 1);
  const normalizedRows = rows.map((row) => [...row, ...Array(width - row.length).fill('')]);
  sheet.getRange(1, 1, normalizedRows.length, width).setValues(normalizedRows);
  stylePickingDashboard_(sheet, normalizedRows.length, 11 + slotRows.length);
  return { instructionId: latestInstruction, progress, lowStockCount: lowStocks.length };
}

function getSheetRecordsWithRows_(sheet) {
  return getSheetRecords_(sheet).map((record, index) => ({ rowNumber: index + 2, record }));
}

function groupSheetItemsByOrder_(items) {
  return items.reduce((groups, item) => {
    const orderNumber = normalizeWorkflowText_(item.record['주문번호']);
    if (orderNumber) {
      if (!groups[orderNumber]) {
        groups[orderNumber] = [];
      }
      groups[orderNumber].push(item);
    }
    return groups;
  }, {});
}

function findSheetItem_(sheet, header, value) {
  const normalized = normalizeWorkflowText_(value);
  return getSheetRecordsWithRows_(sheet).find(
    (item) => normalizeWorkflowText_(item.record[header]) === normalized,
  );
}

function setPickingLineState_(sheet, rowNumber, status, actualQuantity) {
  const headerMap = getHeaderIndexMap_(sheet);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '실제수량', actualQuantity);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '라인상태', status);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '처리일시', new Date());
}

function setPickingHeaderState_(sheet, rowNumber, status, completedAt, reason) {
  const headerMap = getHeaderIndexMap_(sheet);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '상태', status);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '완료일시', completedAt);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '예외사유', reason);
}

function createPickingInstructionId_(sheet) {
  const dateText = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const prefix = `PK-${dateText}-`;
  const sequence =
    [...getExistingValueSet_(sheet, '피킹지시번호')]
      .filter((value) => value.startsWith(prefix))
      .map((value) => Number(value.slice(prefix.length)))
      .reduce((max, value) => (Number.isFinite(value) ? Math.max(max, value) : max), 0) + 1;
  return `${prefix}${String(sequence).padStart(3, '0')}`;
}

function parsePickingAssignees_(value) {
  return [
    ...new Set(
      String(value || '')
        .split(/[\n,]/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
}

function parsePickingAssignmentUnit_(value) {
  const parsed = parseIntegerField_(value || '10');
  if (parsed === null || parsed < 1) throw new Error('담당자별 주문수는 1 이상의 정수여야 합니다.');
  return parsed;
}

function selectPickingAssignee_(assignees, slot, assignmentUnit) {
  if (!assignees.length) return '';
  return assignees[Math.floor((slot - 1) / assignmentUnit) % assignees.length];
}

function normalizePickingConfirmation_(value) {
  return normalizeWorkflowText_(value).toUpperCase();
}

function countPickingStatuses_(records) {
  const counts = {
    [PICKING_STATUS.waiting]: 0,
    [PICKING_STATUS.inProgress]: 0,
    [PICKING_STATUS.completed]: 0,
    [PICKING_STATUS.exception]: 0,
  };
  records.forEach((record) => {
    const status = normalizeWorkflowText_(record['상태']);
    if (counts[status] !== undefined) counts[status] += 1;
  });
  return counts;
}
