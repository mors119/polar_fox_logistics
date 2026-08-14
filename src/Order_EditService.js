// 주문상품 체크박스 편집 시 발송대기 수량과 처리상태를 함께 맞춘다.
function handleOrderItemCheckboxEdit(e) {
  if (!e || !e.range) {
    return;
  }

  const sheet = e.range.getSheet();
  if (sheet.getName() !== ORDER_CONFIG.sheets.orderItems) {
    return;
  }

  if (e.range.getRow() <= 1 || e.range.getColumn() !== 1) {
    return;
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return;
  }

  try {
    const newValue = String(e.value || '').toUpperCase();
    const oldValue = String(e.oldValue || '').toUpperCase();

    if (newValue !== 'TRUE' && newValue !== 'FALSE') {
      return;
    }

    if (newValue === oldValue) {
      return;
    }

    try {
      syncOrderItemCheckboxState_(sheet, e.range.getRow(), newValue === 'TRUE');
    } catch (error) {
      e.range.setValue(oldValue === 'TRUE');
      throw error;
    }
  } finally {
    lock.releaseLock();
  }
}

// 체크되면 실제 출고로 가용재고와 발송대기를 함께 줄이고, 해제 시 되돌린다.
function syncOrderItemCheckboxState_(orderItemSheet, rowNumber, isChecked) {
  const headerMap = getHeaderIndexMap_(orderItemSheet);
  const productCode = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '상품품목코드');
  const quantityText = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '수량');
  const status = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '처리상태');
  const orderNumber = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '주문번호');
  const orderItemNumber = getSheetTextByHeader_(
    orderItemSheet,
    rowNumber,
    headerMap,
    '품목별 주문번호',
  );
  const quantity = parseIntegerField_(quantityText);

  if (!productCode || quantity === null || quantity < 1) {
    throw new Error(`주문상품 ${rowNumber}행의 상품코드 또는 수량이 올바르지 않습니다.`);
  }

  if (isChecked && status === ORDER_CONFIG.shippedOrderItemStatus) {
    return;
  }

  if (!isChecked && status === ORDER_CONFIG.defaultOrderItemStatus) {
    return;
  }

  const previousStatus = status;
  let stockChange = null;
  let orderStatusChange = null;
  let historyRange = { startRow: 0, rowCount: 0 };

  try {
    stockChange = updateProductShipmentStockByCode_(productCode, quantity, isChecked);
    setSheetCellByHeader_(
      orderItemSheet,
      rowNumber,
      headerMap,
      '처리상태',
      isChecked ? ORDER_CONFIG.shippedOrderItemStatus : ORDER_CONFIG.defaultOrderItemStatus,
    );
    orderStatusChange = syncOrderStatusFromItems_(orderItemSheet, orderNumber);
    historyRange = appendInventoryHistory_([
      {
        type: isChecked ? '출고완료' : '출고취소',
        productCode,
        productName: stockChange.productName,
        option: stockChange.option,
        availableDelta: stockChange.availableAfter - stockChange.availableBefore,
        pendingDelta: stockChange.pendingAfter - stockChange.pendingBefore,
        availableAfter: stockChange.availableAfter,
        pendingAfter: stockChange.pendingAfter,
        orderNumber,
        orderItemNumber,
      },
    ]);
  } catch (error) {
    rollbackInventoryHistory_(historyRange.startRow, historyRange.rowCount);
    if (stockChange) {
      restoreProductStockSnapshots_([stockChange]);
    }
    if (orderStatusChange) {
      setSheetCellByHeader_(
        orderStatusChange.sheet,
        orderStatusChange.rowNumber,
        orderStatusChange.headerMap,
        '주문상태',
        orderStatusChange.previousStatus,
      );
    }
    setSheetCellByHeader_(orderItemSheet, rowNumber, headerMap, '처리상태', previousStatus);
    throw error;
  }
}

// 품목 처리상태를 모아 주문을 출고대기, 부분출고, 출고완료로 자동 갱신한다.
function syncOrderStatusFromItems_(orderItemSheet, orderNumber) {
  if (!orderNumber) {
    return null;
  }

  const itemHeaderMap = getHeaderIndexMap_(orderItemSheet);
  const orderNumberColumn = itemHeaderMap['주문번호'];
  const itemStatusColumn = itemHeaderMap['처리상태'];
  const lastRow = orderItemSheet.getLastRow();
  const itemRows =
    lastRow > 1
      ? orderItemSheet
          .getRange(2, 1, lastRow - 1, orderItemSheet.getLastColumn())
          .getDisplayValues()
      : [];
  const statuses = itemRows
    .filter((row) => String(row[orderNumberColumn - 1] || '').trim() === orderNumber)
    .map((row) => String(row[itemStatusColumn - 1] || '').trim());

  if (statuses.length === 0) {
    return null;
  }

  const shippedCount = statuses.filter(
    (status) => status === ORDER_CONFIG.shippedOrderItemStatus,
  ).length;
  const nextStatus =
    shippedCount === statuses.length
      ? ORDER_CONFIG.shippedOrderItemStatus
      : shippedCount > 0
        ? ORDER_CONFIG.partiallyShippedOrderStatus
        : ORDER_CONFIG.defaultOrderStatus;
  const orderSheet = getSheet_(ORDER_CONFIG.sheets.orders);
  const orderHeaderMap = getHeaderIndexMap_(orderSheet);
  const orderNumbers =
    orderSheet.getLastRow() > 1
      ? orderSheet
          .getRange(2, orderHeaderMap['주문번호'], orderSheet.getLastRow() - 1, 1)
          .getDisplayValues()
          .flat()
          .map((value) => String(value || '').trim())
      : [];
  const orderRowIndex = orderNumbers.indexOf(orderNumber);

  if (orderRowIndex === -1) {
    return null;
  }

  const rowNumber = orderRowIndex + 2;
  const previousStatus = getSheetTextByHeader_(orderSheet, rowNumber, orderHeaderMap, '주문상태');
  setSheetCellByHeader_(orderSheet, rowNumber, orderHeaderMap, '주문상태', nextStatus);

  return {
    sheet: orderSheet,
    rowNumber,
    headerMap: orderHeaderMap,
    previousStatus,
  };
}

// 상품품목코드 기준으로 실제 출고/취소 수량을 재고에 반영한다.
function updateProductShipmentStockByCode_(productCode, quantity, isShipped) {
  const productSheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(productSheet);
  const productCodeColumn = headerMap['상품품목코드'];
  const availableStockColumn = headerMap['가용재고'];
  const pendingStockColumn = headerMap['발송대기'];

  if (!productCodeColumn || !availableStockColumn || !pendingStockColumn) {
    throw new Error('상품마스터 시트에 상품품목코드, 가용재고, 발송대기 헤더가 필요합니다.');
  }

  const lastRow = productSheet.getLastRow();
  if (lastRow <= 1) {
    throw new Error('상품마스터 시트에 재고 데이터가 없습니다.');
  }

  const productCodes = productSheet
    .getRange(2, productCodeColumn, lastRow - 1, 1)
    .getDisplayValues()
    .flat()
    .map((value) => String(value || '').trim());
  const rowIndex = productCodes.indexOf(productCode);

  if (rowIndex === -1) {
    throw new Error(`상품마스터에 없는 상품품목코드입니다: ${productCode}`);
  }

  const rowNumber = rowIndex + 2;
  const availableBefore = Number(
    productSheet.getRange(rowNumber, availableStockColumn).getValue() || 0,
  );
  const pendingBefore = Number(
    productSheet.getRange(rowNumber, pendingStockColumn).getValue() || 0,
  );
  const delta = isShipped ? -quantity : quantity;
  const availableAfter = availableBefore + delta;
  const pendingAfter = pendingBefore + delta;

  if (availableAfter < 0 || pendingAfter < 0) {
    throw new Error(`출고 처리 후 재고가 음수가 될 수 없습니다: ${productCode}`);
  }

  try {
    productSheet.getRange(rowNumber, availableStockColumn).setValue(availableAfter);
    productSheet.getRange(rowNumber, pendingStockColumn).setValue(pendingAfter);
    updateProductInventoryIndicators_(productSheet, rowNumber, headerMap, {
      availableStock: availableAfter,
      pendingStock: pendingAfter,
      safetyStock: Number(productSheet.getRange(rowNumber, headerMap['안전재고']).getValue() || 0),
    });
  } catch (error) {
    productSheet.getRange(rowNumber, availableStockColumn).setValue(availableBefore);
    productSheet.getRange(rowNumber, pendingStockColumn).setValue(pendingBefore);
    updateProductInventoryIndicators_(productSheet, rowNumber, headerMap, {
      availableStock: availableBefore,
      pendingStock: pendingBefore,
      safetyStock: Number(productSheet.getRange(rowNumber, headerMap['안전재고']).getValue() || 0),
    });
    throw error;
  }

  return {
    rowNumber,
    availableStock: availableBefore,
    pendingStock: pendingBefore,
    availableBefore,
    pendingBefore,
    availableAfter,
    pendingAfter,
    productName: getSheetTextByHeader_(productSheet, rowNumber, headerMap, '상품명'),
    option: getSheetTextByHeader_(productSheet, rowNumber, headerMap, '옵션'),
  };
}

// 시트 행에서 헤더명 기준으로 셀 표시값을 읽는다.
function getSheetTextByHeader_(sheet, rowNumber, headerMap, headerName) {
  const columnIndex = headerMap[headerName];

  if (!columnIndex) {
    return '';
  }

  return String(sheet.getRange(rowNumber, columnIndex).getDisplayValue() || '').trim();
}
