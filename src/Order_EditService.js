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

    syncOrderItemCheckboxState_(sheet, e.range.getRow(), newValue === 'TRUE');
  } finally {
    lock.releaseLock();
  }
}

// 체크되면 발송대기를 줄이고, 체크 해제되면 다시 발송대기를 복구한다.
function syncOrderItemCheckboxState_(orderItemSheet, rowNumber, isChecked) {
  const headerMap = getHeaderIndexMap_(orderItemSheet);
  const productCode = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '상품품목코드');
  const quantityText = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '수량');
  const status = getSheetTextByHeader_(orderItemSheet, rowNumber, headerMap, '처리상태');
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

  updateProductPendingStockByCode_(productCode, isChecked ? -quantity : quantity);
  setSheetCellByHeader_(
    orderItemSheet,
    rowNumber,
    headerMap,
    '처리상태',
    isChecked ? ORDER_CONFIG.shippedOrderItemStatus : ORDER_CONFIG.defaultOrderItemStatus,
  );
}

// 상품품목코드 기준으로 상품마스터의 발송대기 값을 증감한다.
function updateProductPendingStockByCode_(productCode, delta) {
  const productSheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(productSheet);
  const productCodeColumn = headerMap['상품품목코드'];
  const pendingStockColumn = headerMap['발송대기'];

  if (!productCodeColumn || !pendingStockColumn) {
    throw new Error('상품마스터 시트에 상품품목코드와 발송대기 헤더가 필요합니다.');
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
  const currentPendingStock = Number(productSheet.getRange(rowNumber, pendingStockColumn).getValue() || 0);
  const nextPendingStock = currentPendingStock + delta;

  if (nextPendingStock < 0) {
    throw new Error(
      `발송대기 재고가 음수가 될 수 없습니다: ${productCode} 현재 ${currentPendingStock}, 변경 ${delta}`,
    );
  }

  productSheet.getRange(rowNumber, pendingStockColumn).setValue(nextPendingStock);
}

// 시트 행에서 헤더명 기준으로 셀 표시값을 읽는다.
function getSheetTextByHeader_(sheet, rowNumber, headerMap, headerName) {
  const columnIndex = headerMap[headerName];

  if (!columnIndex) {
    return '';
  }

  return String(sheet.getRange(rowNumber, columnIndex).getDisplayValue() || '').trim();
}
