// 주문 CSV 한 개를 검증, 저장, 롤백, 파일 이동까지 포함해 처리한다.
function processOrderFile(file, parsedTable) {
  let parsedCsv = null;
  let historyContext = null;
  let errorCount = 0;
  const rollbackContext = createOrderRollbackContext_();

  try {
    checkDuplicateFile(file);

    // 주문 흐름은 파싱 후 헤더를 먼저 검증하고, 그 다음 이력을 남긴다.
    parsedCsv = parseOrderCsv(file, parsedTable);
    validateCsv(parsedCsv);
    historyContext = startOrderFileHistory_(file, parsedCsv.rows.length);

    // 행 단위 오류는 모두 오류 시트에 남긴 뒤 파일 전체를 실패 처리한다.
    errorCount = assertOrderValidation_(file, validateOrderRows(parsedCsv.rows), {
      stage: 'ROW_VALIDATION',
      code: 'ROW_VALIDATION_FAILED',
      label: '행 검증',
    });

    errorCount = assertOrderValidation_(file, validateOrderInventory_(parsedCsv.rows), {
      stage: 'INVENTORY_VALIDATION',
      code: 'INVENTORY_VALIDATION_FAILED',
      label: '재고 검증',
    });

    checkDuplicateOrders(parsedCsv.rows);

    // 주문/주문상품은 별도 시트에 저장하므로, 부분 실패를 대비해 시작 행을 기억한다.
    const groupedOrders = groupOrdersByOrderNumber(parsedCsv.rows);
    const importedOrders = importOrders(file, groupedOrders);
    rollbackContext.orderStartRow = importedOrders.orderStartRow;
    rollbackContext.orderRowCount = importedOrders.orderRowCount;

    const importedOrderItems = importOrderItems(file, parsedCsv.rows);
    rollbackContext.orderItemStartRow = importedOrderItems.orderItemStartRow;
    rollbackContext.orderItemRowCount = importedOrderItems.orderItemRowCount;

    const inventoryAdjustment = applyOrderInventoryAdjustments_(parsedCsv.rows, file);
    rollbackContext.productStockSnapshots = inventoryAdjustment.snapshots;
    rollbackContext.inventoryHistoryStartRow = inventoryAdjustment.historyStartRow;
    rollbackContext.inventoryHistoryRowCount = inventoryAdjustment.historyRowCount;

    finalizeOrderFileHistory_(file, {
      rowNumber: historyContext.rowNumber,
      status: 'SUCCESS',
      totalRows: parsedCsv.rows.length,
      orderCount: importedOrders.insertedCount,
      orderItemCount: importedOrderItems.insertedCount,
      errorCount: 0,
      message: '주문 CSV 등록 완료',
    });
    moveFileToSuccessFolder_(file);
    refreshOperationsDashboardsSafely_();

    return {
      orders: importedOrders.orders,
      orderItems: importedOrderItems.orderItems,
    };
  } catch (error) {
    errorCount = Math.max(errorCount, error.validationErrorCount || 0);

    // 일부라도 저장된 뒤 실패하면 방금 넣은 행만 되돌리려고 롤백을 시도한다.
    if (hasOrderImportChanges_(rollbackContext)) {
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
    moveFileToErrorFolder_(file);

    console.error(`주문 파일 처리 실패: ${file.getName()}`, error);
    return {
      orders: [],
      orderItems: [],
    };
  }
}

// 부분 저장 실패 시 되돌릴 범위를 한곳에서 초기화한다.
function createOrderRollbackContext_() {
  return {
    orderStartRow: 0,
    orderRowCount: 0,
    orderItemStartRow: 0,
    orderItemRowCount: 0,
    productStockSnapshots: [],
    inventoryHistoryStartRow: 0,
    inventoryHistoryRowCount: 0,
  };
}

// 행·재고 검증의 공통 실패 기록 규칙을 적용한다.
function assertOrderValidation_(file, validation, failure) {
  if (validation.valid) {
    return 0;
  }

  validation.errors.forEach((error) => {
    recordImportError(file, failure.stage, error);
  });

  const validationError = appError_(
    failure.code,
    `${failure.label} 실패: ${validation.errors.length}건`,
    failure.stage,
  );
  validationError.alreadyLogged = true;
  validationError.validationErrorCount = validation.errors.length;
  throw validationError;
}

function hasOrderImportChanges_(context) {
  return (
    context.orderRowCount > 0 ||
    context.orderItemRowCount > 0 ||
    context.productStockSnapshots.length > 0
  );
}
