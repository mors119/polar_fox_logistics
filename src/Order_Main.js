// 기존 주문 전용 실행 함수는 공통 input 스캐너로 위임한다.
function scanOrderFolder() {
  return scanInputFolder();
}

// 주문 CSV 한 개를 검증, 저장, 롤백, 파일 이동까지 포함해 처리한다.
function processOrderFile(file, parsedTable) {
  let parsedCsv = null;
  let historyContext = null;
  let errorCount = 0;
  let rollbackContext = {
    orderStartRow: 0,
    orderRowCount: 0,
    orderItemStartRow: 0,
    orderItemRowCount: 0,
    productStockSnapshots: [],
  };

  try {
    checkDuplicateFile(file);

    // 주문 흐름은 파싱 후 헤더를 먼저 검증하고, 그 다음 이력을 남긴다.
    parsedCsv = parseOrderCsv(file, parsedTable);
    validateCsv(parsedCsv);
    historyContext = startOrderFileHistory_(file, parsedCsv.rows.length);

    // 행 단위 오류는 모두 오류 시트에 남긴 뒤 파일 전체를 실패 처리한다.
    const rowValidation = validateOrderRows(parsedCsv.rows);
    if (!rowValidation.valid) {
      errorCount = rowValidation.errors.length;
      rowValidation.errors.forEach((error) => {
        recordImportError(file, 'ROW_VALIDATION', error);
      });

      const validationError = appError_(
        'ROW_VALIDATION_FAILED',
        `행 검증 실패: ${rowValidation.errors.length}건`,
        'ROW_VALIDATION',
      );
      validationError.alreadyLogged = true;
      throw validationError;
    }

    const inventoryValidation = validateOrderInventory_(parsedCsv.rows);
    if (!inventoryValidation.valid) {
      errorCount = inventoryValidation.errors.length;
      inventoryValidation.errors.forEach((error) => {
        recordImportError(file, 'INVENTORY_VALIDATION', error);
      });

      const inventoryError = appError_(
        'INVENTORY_VALIDATION_FAILED',
        `재고 검증 실패: ${inventoryValidation.errors.length}건`,
        'INVENTORY_VALIDATION',
      );
      inventoryError.alreadyLogged = true;
      throw inventoryError;
    }

    checkDuplicateOrders(parsedCsv.rows);

    // 주문/주문상품은 별도 시트에 저장하므로, 부분 실패를 대비해 시작 행을 기억한다.
    const groupedOrders = groupOrdersByOrderNumber(parsedCsv.rows);
    const importedOrders = importOrders(file, groupedOrders);
    rollbackContext.orderStartRow = importedOrders.orderStartRow;
    rollbackContext.orderRowCount = importedOrders.orderRowCount;

    const importedOrderItems = importOrderItems(file, parsedCsv.rows);
    rollbackContext.orderItemStartRow = importedOrderItems.orderItemStartRow;
    rollbackContext.orderItemRowCount = importedOrderItems.orderItemRowCount;

    rollbackContext.productStockSnapshots = applyOrderInventoryAdjustments_(parsedCsv.rows);

    finalizeOrderFileHistory_(file, {
      rowNumber: historyContext.rowNumber,
      status: 'SUCCESS',
      totalRows: parsedCsv.rows.length,
      orderCount: importedOrders.insertedCount,
      orderItemCount: importedOrderItems.insertedCount,
      errorCount: 0,
      message: '주문 CSV 등록 완료',
    });
    trashOrderFile_(file);

    return {
      orders: importedOrders.orders,
      orderItems: importedOrderItems.orderItems,
    };
  } catch (error) {
    // 일부라도 저장된 뒤 실패하면 방금 넣은 행만 되돌리려고 롤백을 시도한다.
    if (
      rollbackContext.orderRowCount > 0 ||
      rollbackContext.orderItemRowCount > 0 ||
      rollbackContext.productStockSnapshots.length > 0
    ) {
      try {
        rollbackImportedRows(rollbackContext);
      } catch (rollbackError) {
        console.error('주문 CSV 롤백 실패', rollbackError);
        recordImportError(file, 'ROLLBACK', {
          rowNumber: '',
          orderNumber: '',
          orderItemNumber: '',
          code: rollbackError.code || 'ROLLBACK_FAILED',
          message: rollbackError.message || String(rollbackError),
        });
        errorCount += 1;
      }
    }

    if (!error.alreadyLogged) {
      recordImportError(file, error.stage || 'PROCESS', {
        rowNumber: error.rowNumber || '',
        orderNumber: error.orderNumber || '',
        orderItemNumber: error.orderItemNumber || '',
        code: error.code || 'UNEXPECTED_ERROR',
        message: error.message || String(error),
      });
      errorCount += 1;
    }

    finalizeOrderFileHistory_(file, {
      rowNumber: historyContext ? historyContext.rowNumber : 0,
      status: 'FAILED',
      totalRows: parsedCsv ? parsedCsv.rows.length : 0,
      orderCount: 0,
      orderItemCount: 0,
      errorCount: errorCount || 1,
      message: error.message || String(error),
    });
    moveOrderFileToErrorFolder_(file);

    console.error(`주문 파일 처리 실패: ${file.getName()}`, error);
    return {
      orders: [],
      orderItems: [],
    };
  }
}
