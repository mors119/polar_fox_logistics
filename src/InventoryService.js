// 재고 수량을 기준으로 운영자가 바로 확인할 수 있는 상태를 계산한다.
function calculateInventoryStatus_(availableStock, pendingStock, safetyStock) {
  const remainingStock = Number(availableStock || 0) - Number(pendingStock || 0);
  const normalizedSafetyStock = Number(safetyStock || 0);

  if (remainingStock <= 0) {
    return '품절';
  }

  if (normalizedSafetyStock > 0 && remainingStock <= normalizedSafetyStock) {
    return '안전재고 부족';
  }

  return '정상';
}

// 이전 모델의 가용재고에 미리 차감된 예약 수량을 다시 합쳐 실물 재고로 복원한다.
function calculateMigratedAvailableStock_(oldAvailableStock, pendingStock) {
  return Number(oldAvailableStock || 0) + Number(pendingStock || 0);
}

// 상품마스터의 출고 후 잔량과 재고 상태를 항상 같은 기준으로 맞춘다.
function updateProductInventoryIndicators_(sheet, rowNumber, headerMap, values) {
  const availableStock = Number(values.availableStock || 0);
  const pendingStock = Number(values.pendingStock || 0);
  const safetyStock = Number(values.safetyStock || 0);
  const remainingStock = availableStock - pendingStock;

  setMappedProductCell_(sheet, rowNumber, headerMap, '출고후잔량', remainingStock);
  setMappedProductCell_(
    sheet,
    rowNumber,
    headerMap,
    '재고상태',
    calculateInventoryStatus_(availableStock, pendingStock, safetyStock),
  );

  return remainingStock;
}

// 재고이력 시트에 쓸 행 형식을 한 곳에서 관리한다.
function buildInventoryHistoryRow_(change) {
  return [
    change.timestamp || new Date(),
    change.type || '',
    change.productCode || '',
    change.productName || '',
    change.option || '',
    Number(change.availableDelta || 0),
    Number(change.pendingDelta || 0),
    Number(change.availableAfter || 0),
    Number(change.pendingAfter || 0),
    change.orderNumber || '',
    change.orderItemNumber || '',
    change.sourceFileName || '',
    change.note || '',
    change.taskId || '',
  ];
}

// 여러 상품의 재고 변동을 한 번에 추가하고 롤백용 범위를 반환한다.
function appendInventoryHistory_(changes) {
  if (!changes || changes.length === 0) {
    return { startRow: 0, rowCount: 0 };
  }

  const sheet = getSheet_(CONFIG.sheets.inventoryHistory);
  const values = changes.map(buildInventoryHistoryRow_);
  const startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, values.length, INVENTORY_HISTORY_HEADERS.length).setValues(values);
  return { startRow, rowCount: values.length };
}

// 주문 처리가 실패하면 해당 주문이 남긴 재고이력도 같이 제거한다.
function rollbackInventoryHistory_(startRow, rowCount) {
  if (startRow > 0 && rowCount > 0) {
    getSheet_(CONFIG.sheets.inventoryHistory).deleteRows(startRow, rowCount);
  }
}

// 기존 버전은 주문 예약 시 가용재고를 미리 차감했으므로 새 기준으로 한 번만 변환한다.
function migrateInventoryModel_() {
  const properties = PropertiesService.getScriptProperties();
  const targetVersion = '2';

  if (properties.getProperty(CONFIG.properties.inventoryModelVersion) === targetVersion) {
    return 0;
  }

  const sheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(sheet);
  const availableStockColumn = headerMap['가용재고'];
  const pendingStockColumn = headerMap['발송대기'];
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const originalRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues() : [];

  try {
    if (lastRow > 1) {
      const rowCount = lastRow - 1;
      const availableStocks = sheet.getRange(2, availableStockColumn, rowCount, 1).getValues();
      const pendingStocks = sheet.getRange(2, pendingStockColumn, rowCount, 1).getValues();

      availableStocks.forEach((row, index) => {
        const rowNumber = index + 2;
        const oldAvailableStock = Number(row[0] || 0);
        const pendingStock = Number(pendingStocks[index][0] || 0);
        const migratedAvailableStock = calculateMigratedAvailableStock_(
          oldAvailableStock,
          pendingStock,
        );
        sheet.getRange(rowNumber, availableStockColumn).setValue(migratedAvailableStock);
        updateProductInventoryIndicators_(sheet, rowNumber, headerMap, {
          availableStock: migratedAvailableStock,
          pendingStock,
          safetyStock: Number(sheet.getRange(rowNumber, headerMap['안전재고']).getValue() || 0),
        });
      });
    }

    properties.setProperty(CONFIG.properties.inventoryModelVersion, targetVersion);
  } catch (error) {
    if (originalRows.length > 0) {
      sheet.getRange(2, 1, originalRows.length, lastColumn).setValues(originalRows);
    }
    throw error;
  }

  return Math.max(0, lastRow - 1);
}
