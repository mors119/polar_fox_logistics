// 검증이 끝난 상품 목록은 기존 상품은 갱신하고, 없는 상품은 신규 행으로 추가한다.
function importProducts_(file, products, options) {
  if (products.length === 0) {
    return 0;
  }

  const sheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(sheet);
  const existingProducts = getExistingProductMap_(sheet);
  const now = new Date();
  const rowsToAppend = [];
  const inventoryChanges = [];
  const existingRowSnapshots = [];
  let appendedStartRow = 0;
  let appendedRowCount = 0;
  let affectedCount = 0;
  const inventoryMode = (options && options.inventoryMode) || 'additive';

  try {
    products.forEach((product) => {
      const productCode = String(product['상품품목코드'] || '').trim();
      const existingProduct = existingProducts[productCode];

      if (!existingProduct) {
        const availableStock = getNumericProductValue_(product['가용재고']);
        const pendingStock = 0;
        const safetyStock = getNumericProductValue_(product['안전재고']);
        rowsToAppend.push(
          buildProductSheetRow_(product, {
            등록일: now,
            승인자: '',
            출고후잔량: availableStock - pendingStock,
            원본파일ID: file.getId(),
            원본파일명: file.getName(),
            재고상태: calculateInventoryStatus_(availableStock, pendingStock, safetyStock),
          }),
        );
        inventoryChanges.push({
          timestamp: now,
          type: inventoryMode === 'snapshot' ? '재고동기화' : '신규입고',
          productCode,
          productName: product['상품명'],
          option: product['옵션'],
          availableDelta: availableStock,
          pendingDelta: 0,
          availableAfter: availableStock,
          pendingAfter: pendingStock,
          sourceFileName: file.getName(),
        });
        affectedCount += 1;
        return;
      }

      existingRowSnapshots.push({
        rowNumber: existingProduct.rowNumber,
        values: sheet
          .getRange(existingProduct.rowNumber, 1, 1, sheet.getLastColumn())
          .getValues()[0],
      });
      const change = updateExistingProductRow_(
        sheet,
        headerMap,
        existingProduct.rowNumber,
        product,
        file,
        now,
        { inventoryMode },
      );
      if (change.availableDelta !== 0 || change.pendingDelta !== 0) {
        inventoryChanges.push(change);
      }
      affectedCount += 1;
    });

    if (rowsToAppend.length > 0) {
      appendedStartRow = sheet.getLastRow() + 1;
      appendedRowCount = rowsToAppend.length;
      sheet
        .getRange(appendedStartRow, 1, rowsToAppend.length, rowsToAppend[0].length)
        .setValues(rowsToAppend);
    }

    appendInventoryHistory_(inventoryChanges);
  } catch (error) {
    existingRowSnapshots.forEach((snapshot) => {
      sheet.getRange(snapshot.rowNumber, 1, 1, snapshot.values.length).setValues([snapshot.values]);
    });
    if (appendedStartRow > 0 && appendedRowCount > 0) {
      sheet.deleteRows(appendedStartRow, appendedRowCount);
    }
    throw error;
  }

  return affectedCount;
}

function buildProductSheetRow_(product, metadata) {
  return PRODUCT_SHEET_HEADERS.map((sheetHeader) => {
    if (Object.prototype.hasOwnProperty.call(metadata || {}, sheetHeader)) {
      return metadata[sheetHeader];
    }
    const canonicalHeader = getCanonicalSheetHeader_(sheetHeader);
    return convertNewProductValue_(canonicalHeader, product[canonicalHeader]);
  });
}

// 숫자와 날짜는 시트에서 후속 활용이 쉽도록 타입을 맞춰 넣는다.
function convertNewProductValue_(header, value) {
  if (header === '발송대기') {
    return 0;
  }

  if (NUMERIC_HEADERS.includes(header)) {
    return getNumericProductValue_(value);
  }

  if (header === '유효기간' && value) {
    return new Date(String(value).replace(/\//g, '-') + 'T00:00:00');
  }

  return value;
}

// 상품 숫자는 빈칸을 0으로 보고 천 단위 쉼표를 제거한다.
function getNumericProductValue_(value) {
  if (value === '' || value === null || value === undefined) {
    return 0;
  }

  return Number(String(value).replace(/,/g, ''));
}

function calculateAvailableStockImport_(currentStock, importedStock, inventoryMode) {
  const current = Number(currentStock || 0);
  const imported = getNumericProductValue_(importedStock);
  const after = inventoryMode === 'snapshot' ? imported : current + imported;
  return { delta: after - current, after };
}

// 기존 상품마스터 행은 숫자 필드는 누적하고, 일반 필드는 새 값이 있으면 갱신한다.
function updateExistingProductRow_(sheet, headerMap, rowNumber, product, file, now, options) {
  const currentAvailableStock = Number(
    sheet.getRange(rowNumber, headerMap['가용재고']).getValue() || 0,
  );
  const currentPendingStock = Number(
    sheet.getRange(rowNumber, headerMap['발송대기']).getValue() || 0,
  );
  const inventoryMode = (options && options.inventoryMode) || 'additive';
  const availableImport = calculateAvailableStockImport_(
    currentAvailableStock,
    product['가용재고'],
    inventoryMode,
  );
  const availableDelta = availableImport.delta;

  PRODUCT_HEADERS.forEach((header) => {
    const columnIndex = headerMap[header];

    if (!columnIndex) {
      return;
    }

    const nextValue = product[header];

    if (SYSTEM_MANAGED_PRODUCT_HEADERS.includes(header)) {
      return;
    }

    if (ADDITIVE_PRODUCT_HEADERS.includes(header)) {
      const currentValue = Number(sheet.getRange(rowNumber, columnIndex).getValue() || 0);
      const delta = getNumericProductValue_(nextValue);
      const updatedValue =
        inventoryMode === 'snapshot' && header === '가용재고'
          ? availableImport.after
          : currentValue + delta;
      sheet.getRange(rowNumber, columnIndex).setValue(updatedValue);
      return;
    }

    if (NUMERIC_HEADERS.includes(header)) {
      if (String(nextValue ?? '').trim() !== '') {
        sheet.getRange(rowNumber, columnIndex).setValue(getNumericProductValue_(nextValue));
      }
      return;
    }

    if (header === '유효기간') {
      if (nextValue) {
        sheet
          .getRange(rowNumber, columnIndex)
          .setValue(new Date(String(nextValue).replace(/\//g, '-') + 'T00:00:00'));
      }
      return;
    }

    if (String(nextValue || '').trim() !== '') {
      sheet.getRange(rowNumber, columnIndex).setValue(nextValue);
    }
  });

  setMappedProductCell_(sheet, rowNumber, headerMap, '원본파일ID', file.getId());
  setMappedProductCell_(sheet, rowNumber, headerMap, '원본파일명', file.getName());
  setMappedProductCell_(sheet, rowNumber, headerMap, '등록일시', now);

  const availableAfter = availableImport.after;
  const safetyStockColumn = headerMap['안전재고'];
  const safetyStock = safetyStockColumn
    ? Number(sheet.getRange(rowNumber, safetyStockColumn).getValue() || 0)
    : 0;
  updateProductInventoryIndicators_(sheet, rowNumber, headerMap, {
    availableStock: availableAfter,
    pendingStock: currentPendingStock,
    safetyStock,
  });

  return {
    timestamp: now,
    type: inventoryMode === 'snapshot' ? '재고동기화' : '재입고',
    productCode: String(product['상품품목코드'] || '').trim(),
    productName:
      product['상품명'] ||
      String(sheet.getRange(rowNumber, headerMap['상품명']).getDisplayValue() || '').trim(),
    option:
      product['옵션'] ||
      String(sheet.getRange(rowNumber, headerMap['옵션']).getDisplayValue() || '').trim(),
    availableDelta,
    pendingDelta: 0,
    availableAfter,
    pendingAfter: currentPendingStock,
    sourceFileName: file.getName(),
  };
}

// 상품마스터를 상품품목코드 기준 맵으로 읽어 기존 행 갱신에 사용한다.
function getExistingProductMap_(sheet) {
  const records = getSheetRecords_(sheet);
  const map = {};

  records.forEach((record, index) => {
    const productCode = getRecordValueByAliases_(record, '상품품목코드');

    if (!productCode) {
      return;
    }

    map[productCode] = {
      rowNumber: index + 2,
      record,
    };
  });

  return map;
}

// 헤더명 기준으로 상품마스터 특정 셀을 갱신한다.
function setMappedProductCell_(sheet, rowNumber, headerMap, headerName, value) {
  const columnIndex = headerMap[headerName];

  if (columnIndex) {
    sheet.getRange(rowNumber, columnIndex).setValue(value);
  }
}
