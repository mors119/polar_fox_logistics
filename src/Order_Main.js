function scanOrderFolder() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log("다른 주문 CSV 작업이 실행 중입니다.");
    return;
  }

  try {
    const folder = getOrderInputFolder_();
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      if (!isCsvFile_(file)) {
        continue;
      }

      processOrderFile(file);
    }
  } finally {
    lock.releaseLock();
  }
}

function processOrderFile(file) {
  let parsedCsv = null;
  let historyContext = null;
  let errorCount = 0;
  let rollbackContext = {
    orderStartRow: 0,
    orderRowCount: 0,
    orderItemStartRow: 0,
    orderItemRowCount: 0
  };

  try {
    checkDuplicateFile(file);

    parsedCsv = parseOrderCsv(file);
    validateCsv(parsedCsv);
    historyContext = startOrderFileHistory_(file, parsedCsv.rows.length);

    const rowValidation = validateOrderRows(parsedCsv.rows);
    if (!rowValidation.valid) {
      errorCount = rowValidation.errors.length;
      rowValidation.errors.forEach(error => {
        recordImportError(file, "ROW_VALIDATION", error);
      });

      const validationError = appError_(
        "ROW_VALIDATION_FAILED",
        `행 검증 실패: ${rowValidation.errors.length}건`,
        "ROW_VALIDATION"
      );
      validationError.alreadyLogged = true;
      throw validationError;
    }

    checkDuplicateOrderItems(parsedCsv.rows);

    const groupedOrders = groupOrdersByOrderNumber(parsedCsv.rows);
    const importedOrders = importOrders(file, groupedOrders);
    rollbackContext.orderStartRow = importedOrders.orderStartRow;
    rollbackContext.orderRowCount = importedOrders.orderRowCount;

    const importedOrderItems = importOrderItems(file, parsedCsv.rows);
    rollbackContext.orderItemStartRow = importedOrderItems.orderItemStartRow;
    rollbackContext.orderItemRowCount = importedOrderItems.orderItemRowCount;

    moveProcessedFile(file);
    finalizeOrderFileHistory_(file, {
      rowNumber: historyContext.rowNumber,
      status: "SUCCESS",
      totalRows: parsedCsv.rows.length,
      orderCount: importedOrders.insertedCount,
      orderItemCount: importedOrderItems.insertedCount,
      errorCount: 0,
      message: "주문 CSV 등록 완료"
    });

    return {
      orders: importedOrders.orders,
      orderItems: importedOrderItems.orderItems
    };
  } catch (error) {
    if (
      rollbackContext.orderRowCount > 0 ||
      rollbackContext.orderItemRowCount > 0
    ) {
      try {
        rollbackImportedRows(rollbackContext);
      } catch (rollbackError) {
        console.error("주문 CSV 롤백 실패", rollbackError);
        recordImportError(file, "ROLLBACK", {
          rowNumber: "",
          orderNumber: "",
          orderItemNumber: "",
          code: rollbackError.code || "ROLLBACK_FAILED",
          message: rollbackError.message || String(rollbackError)
        });
        errorCount += 1;
      }
    }

    if (!error.alreadyLogged) {
      recordImportError(file, error.stage || "PROCESS", {
        rowNumber: error.rowNumber || "",
        orderNumber: error.orderNumber || "",
        orderItemNumber: error.orderItemNumber || "",
        code: error.code || "UNEXPECTED_ERROR",
        message: error.message || String(error)
      });
      errorCount += 1;
    }

    try {
      moveErrorFile(file);
    } catch (moveError) {
      console.error("오류 파일 이동 실패", moveError);
    }

    finalizeOrderFileHistory_(file, {
      rowNumber: historyContext ? historyContext.rowNumber : 0,
      status: "FAILED",
      totalRows: parsedCsv ? parsedCsv.rows.length : 0,
      orderCount: 0,
      orderItemCount: 0,
      errorCount: errorCount || 1,
      message: error.message || String(error)
    });

    console.error(`주문 파일 처리 실패: ${file.getName()}`, error);
    return {
      orders: [],
      orderItems: []
    };
  }
}
