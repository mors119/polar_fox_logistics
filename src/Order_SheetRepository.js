// 주문번호 기준으로 묶어두면 주문 시트는 한 주문당 한 번만 저장할 수 있다.
function groupOrdersByOrderNumber(rows) {
  const grouped = {};

  rows.forEach((row) => {
    const orderNumber = getTrimmedField_(row, '주문번호');
    if (!grouped[orderNumber]) {
      grouped[orderNumber] = [];
    }
    grouped[orderNumber].push(row);
  });

  return grouped;
}

// 주문 시트에는 주문 단위 정보만 저장하고, 기존 주문번호는 건너뛴다.
function importOrders(file, groupedOrders) {
  const sheet = getSheet_(ORDER_CONFIG.sheets.orders);
  const existingOrderNumbers = getExistingValueSet_(sheet, '주문번호');
  const now = new Date();
  const orderNumbers = Object.keys(groupedOrders);
  const values = [];
  const resultOrders = [];

  orderNumbers.forEach((orderNumber) => {
    const firstRow = groupedOrders[orderNumber][0];
    resultOrders.push({
      orderNumber,
    });

    if (existingOrderNumbers.has(orderNumber)) {
      return;
    }

    values.push([
      orderNumber,
      getTrimmedField_(firstRow, '쇼핑몰'),
      getTrimmedField_(firstRow, '쇼핑몰 번호'),
      getTrimmedField_(firstRow, '배송메세지'),
      getNumericFieldOrBlank_(firstRow, '총주문금액'),
      getNumericFieldOrBlank_(firstRow, '결제금액'),
      getTrimmedField_(firstRow, '수령인'),
      getTrimmedField_(firstRow, '수령인 휴대전화'),
      getTrimmedField_(firstRow, '수령인 우편번호'),
      getTrimmedField_(firstRow, '수령인 주소'),
      ORDER_CONFIG.defaultOrderStatus,
      '',
      file.getId(),
      file.getName(),
      now,
      '',
      '',
      '',
      '',
    ]);
  });

  const writeResult = appendRowsToSheet_(sheet, values);

  return {
    orders: resultOrders,
    insertedCount: values.length,
    orderStartRow: writeResult.startRow,
    orderRowCount: writeResult.rowCount,
  };
}

// 주문상품 시트에는 CSV의 각 행을 그대로 품목 단위로 저장한다.
function importOrderItems(file, rows) {
  const sheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const now = new Date();
  const values = rows.map((row) => [
    false,
    getTrimmedField_(row, '품목별 주문번호'),
    getTrimmedField_(row, '주문번호'),
    getTrimmedField_(row, '상품품목코드'),
    getTrimmedField_(row, '주문상품명'),
    getTrimmedField_(row, '상품옵션'),
    getNumericFieldOrBlank_(row, '수량'),
    getNumericFieldOrBlank_(row, '판매가'),
    ORDER_CONFIG.defaultOrderItemStatus,
    file.getId(),
    file.getName(),
    now,
    '',
  ]);

  const writeResult = appendRowsToSheet_(sheet, values);

  if (writeResult.rowCount > 0) {
    sheet.getRange(writeResult.startRow, 1, writeResult.rowCount, 1).insertCheckboxes();
  }

  const orderItems = rows.map((row) => ({
    orderItemNumber: getTrimmedField_(row, '품목별 주문번호'),
    orderNumber: getTrimmedField_(row, '주문번호'),
    productItemCode: getTrimmedField_(row, '상품품목코드'),
    quantity: getNumericFieldOrBlank_(row, '수량'),
  }));

  return {
    orderItems,
    insertedCount: values.length,
    orderItemStartRow: writeResult.startRow,
    orderItemRowCount: writeResult.rowCount,
  };
}

// 주문 또는 주문상품 중 일부만 들어간 경우를 대비해 방금 넣은 범위만 삭제한다.
function rollbackImportedRows(context) {
  const orderItemSheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const orderSheet = getSheet_(ORDER_CONFIG.sheets.orders);

  if (context.productStockSnapshots && context.productStockSnapshots.length > 0) {
    restoreProductStockSnapshots_(context.productStockSnapshots);
  }

  rollbackInventoryHistory_(
    context.inventoryHistoryStartRow || 0,
    context.inventoryHistoryRowCount || 0,
  );

  if (context.orderItemRowCount > 0 && context.orderItemStartRow) {
    orderItemSheet.deleteRows(context.orderItemStartRow, context.orderItemRowCount);
  }

  if (context.orderRowCount > 0 && context.orderStartRow) {
    orderSheet.deleteRows(context.orderStartRow, context.orderRowCount);
  }
}

// 주문이 적재되면 실물 재고는 유지하고 발송대기만 늘려 수량을 예약한다.
function applyOrderInventoryAdjustments_(rows, file) {
  const productSheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(productSheet);
  const productCodeColumn = headerMap['상품품목코드'];
  const availableStockColumn = headerMap['가용재고'];
  const pendingStockColumn = headerMap['발송대기'];

  if (!productCodeColumn || !availableStockColumn || !pendingStockColumn) {
    throw appError_(
      'PRODUCT_SHEET_HEADER_MISSING',
      '상품마스터 시트에 상품품목코드, 가용재고, 발송대기 헤더가 필요합니다.',
      'INVENTORY_APPLY',
    );
  }

  const requestedQuantityMap = buildRequestedQuantityMap_(rows);
  const lastRow = productSheet.getLastRow();

  if (lastRow <= 1) {
    throw appError_(
      'PRODUCT_SHEET_EMPTY',
      '상품마스터 시트에 재고 데이터가 없습니다.',
      'INVENTORY_APPLY',
    );
  }

  const productCodes = productSheet
    .getRange(2, productCodeColumn, lastRow - 1, 1)
    .getDisplayValues()
    .flat()
    .map((value) => String(value || '').trim());
  const availableStocks = productSheet
    .getRange(2, availableStockColumn, lastRow - 1, 1)
    .getValues();
  const pendingStocks = productSheet.getRange(2, pendingStockColumn, lastRow - 1, 1).getValues();
  const productRecords = getSheetRecords_(productSheet);
  const snapshots = [];
  const changes = [];
  const adjustments = [];

  Object.keys(requestedQuantityMap).forEach((productCode) => {
    const rowIndex = productCodes.indexOf(productCode);

    if (rowIndex === -1) {
      throw appError_(
        'PRODUCT_NOT_FOUND',
        `상품마스터에 없는 상품품목코드입니다: ${productCode}`,
        'INVENTORY_APPLY',
      );
    }

    const sheetRowNumber = rowIndex + 2;
    const availableStock = Number(availableStocks[rowIndex][0] || 0);
    const pendingStock = Number(pendingStocks[rowIndex][0] || 0);
    const requestedQuantity = requestedQuantityMap[productCode];

    if (requestedQuantity > availableStock - pendingStock) {
      throw appError_(
        'INSUFFICIENT_STOCK',
        `재고 부족: ${productCode} 주문합계 ${requestedQuantity}, 출고후잔량 ${availableStock - pendingStock}`,
        'INVENTORY_APPLY',
      );
    }

    snapshots.push({
      rowNumber: sheetRowNumber,
      availableStock,
      pendingStock,
    });
    adjustments.push({
      rowNumber: sheetRowNumber,
      availableStock,
      pendingStock: pendingStock + requestedQuantity,
    });
    const relatedOrderNumbers = rows
      .filter((row) => getTrimmedField_(row, '상품품목코드') === productCode)
      .map((row) => getTrimmedField_(row, '주문번호'))
      .filter((value, index, values) => value && values.indexOf(value) === index);
    const productRecord = productRecords[rowIndex] || {};
    changes.push({
      type: '주문예약',
      productCode,
      productName: getRecordValueByAliases_(productRecord, '상품명'),
      option: getRecordValueByAliases_(productRecord, '옵션'),
      availableDelta: 0,
      pendingDelta: requestedQuantity,
      availableAfter: availableStock,
      pendingAfter: pendingStock + requestedQuantity,
      orderNumber: relatedOrderNumbers.join(', '),
      sourceFileName: file ? file.getName() : '',
    });
  });

  try {
    adjustments.forEach((adjustment) => {
      productSheet
        .getRange(adjustment.rowNumber, pendingStockColumn)
        .setValue(adjustment.pendingStock);
      updateProductInventoryIndicators_(productSheet, adjustment.rowNumber, headerMap, {
        availableStock: adjustment.availableStock,
        pendingStock: adjustment.pendingStock,
        safetyStock: Number(
          productSheet.getRange(adjustment.rowNumber, headerMap['안전재고']).getValue() || 0,
        ),
      });
    });

    const historyRange = appendInventoryHistory_(changes);
    return {
      snapshots,
      historyStartRow: historyRange.startRow,
      historyRowCount: historyRange.rowCount,
    };
  } catch (error) {
    restoreProductStockSnapshots_(snapshots);
    throw error;
  }
}

// 재고 조정 도중 실패하면 주문 전 값으로 원복한다.
function restoreProductStockSnapshots_(snapshots) {
  const productSheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(productSheet);
  const availableStockColumn = headerMap['가용재고'];
  const pendingStockColumn = headerMap['발송대기'];

  snapshots.forEach((snapshot) => {
    productSheet
      .getRange(snapshot.rowNumber, availableStockColumn)
      .setValue(snapshot.availableStock);
    productSheet.getRange(snapshot.rowNumber, pendingStockColumn).setValue(snapshot.pendingStock);
    updateProductInventoryIndicators_(productSheet, snapshot.rowNumber, headerMap, {
      availableStock: snapshot.availableStock,
      pendingStock: snapshot.pendingStock,
      safetyStock: Number(
        productSheet.getRange(snapshot.rowNumber, headerMap['안전재고']).getValue() || 0,
      ),
    });
  });
}

// 주문 파일 내부의 상품별 총 수량을 계산해 재고 차감과 검증에서 공통으로 사용한다.
function buildRequestedQuantityMap_(rows) {
  return rows.reduce((result, row) => {
    const productCode = getTrimmedField_(row, '상품품목코드');
    const quantity = parseIntegerField_(getTrimmedField_(row, '수량'));

    if (!productCode || quantity === null || quantity < 1) {
      return result;
    }

    result[productCode] = (result[productCode] || 0) + quantity;
    return result;
  }, {});
}

// 빈 배열이면 아무 작업도 하지 않고, 아니면 현재 마지막 행 아래에 일괄 추가한다.
function appendRowsToSheet_(sheet, values) {
  if (!values || values.length === 0) {
    return {
      startRow: 0,
      rowCount: 0,
    };
  }

  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, values[0].length).setValues(values);

  return {
    startRow,
    rowCount: values.length,
  };
}

// 특정 헤더 컬럼의 기존 값들을 Set으로 만들어 중복 검사에 재사용한다.
function getExistingValueSet_(sheet, headerName) {
  const headerMap = getHeaderIndexMap_(sheet);
  const columnIndex = headerMap[headerName];
  const values = new Set();

  if (!columnIndex || sheet.getLastRow() <= 1) {
    return values;
  }

  sheet
    .getRange(2, columnIndex, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat()
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .forEach((value) => values.add(value));

  return values;
}

// 주문번호 중복 검사용 래퍼 함수다.
function getExistingOrderNumbers_() {
  return getExistingValueSet_(getSheet_(ORDER_CONFIG.sheets.orders), '주문번호');
}

// 헤더명 -> 컬럼 번호 매핑을 만들어 동적 시트 접근에 사용한다.
function getHeaderIndexMap_(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const map = {};

  headers.forEach((header, index) => {
    const normalized = normalizeHeader_(header);
    if (normalized) {
      map[normalized] = index + 1;
    }
  });

  return map;
}

// 시트를 헤더 기반 레코드 배열로 읽어와 검색 로직에서 재사용한다.
function getSheetRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow <= 1 || lastColumn === 0) {
    return [];
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(normalizeHeader_);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getDisplayValues();

  return values.map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) {
        record[header] = String(row[index] ?? '').trim();
      }
    });
    return record;
  });
}

// 과거 헤더명 변경에 대응하려고 별칭 배열도 받을 수 있게 만든 조회 함수다.
function getRecordValueByAliases_(record, aliases) {
  const aliasList = Array.isArray(aliases) ? aliases : [aliases];

  for (let index = 0; index < aliasList.length; index += 1) {
    const value = record[aliasList[index]];
    if (value !== undefined && value !== '') {
      return value;
    }
  }

  return '';
}

// 공백 정리까지 포함한 문자열 필드 읽기 함수다.
function getTrimmedField_(record, fieldName) {
  return String(record[fieldName] ?? '').trim();
}

// 값이 없으면 빈칸을 유지하고, 값이 있으면 숫자로 바꿔서 반환한다.
function getNumericFieldOrBlank_(record, fieldName) {
  const rawValue = getTrimmedField_(record, fieldName);
  if (!rawValue) {
    return '';
  }

  const numberValue = parseNumberField_(rawValue);
  return numberValue === null ? '' : numberValue;
}

// 금액류 필드는 쉼표를 제거한 뒤 Number 변환만 수행한다.
function parseNumberField_(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  if (!normalized) {
    return null;
  }

  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) ? numberValue : null;
}

// 수량처럼 정수만 허용하는 값은 별도 파서로 검사한다.
function parseIntegerField_(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}
