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

function importOrderItems(file, rows) {
  const sheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const now = new Date();
  const values = rows.map((row) => [
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
  ]);

  const writeResult = appendRowsToSheet_(sheet, values);
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

function rollbackImportedRows(context) {
  const orderItemSheet = getSheet_(ORDER_CONFIG.sheets.orderItems);
  const orderSheet = getSheet_(ORDER_CONFIG.sheets.orders);

  if (context.orderItemRowCount > 0 && context.orderItemStartRow) {
    orderItemSheet.deleteRows(context.orderItemStartRow, context.orderItemRowCount);
  }

  if (context.orderRowCount > 0 && context.orderStartRow) {
    orderSheet.deleteRows(context.orderStartRow, context.orderRowCount);
  }
}

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

function getExistingOrderItemNumbers_() {
  return getExistingValueSet_(getSheet_(ORDER_CONFIG.sheets.orderItems), '품목별 주문번호');
}

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

function getTrimmedField_(record, fieldName) {
  return String(record[fieldName] ?? '').trim();
}

function getNumericFieldOrBlank_(record, fieldName) {
  const rawValue = getTrimmedField_(record, fieldName);
  if (!rawValue) {
    return '';
  }

  const numberValue = parseNumberField_(rawValue);
  return numberValue === null ? '' : numberValue;
}

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

function parseIntegerField_(value) {
  const normalized = String(value ?? '')
    .trim()
    .replace(/,/g, '');
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return Number(normalized);
}
