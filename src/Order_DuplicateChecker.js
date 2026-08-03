function checkDuplicateFile(file) {
  const sheet = ensureSheetContainsHeaders_(ORDER_CONFIG.sheets.history, FILE_HISTORY_HEADERS);
  const records = getSheetRecords_(sheet);

  const isSuccess = records.some(
    (record) =>
      getRecordValueByAliases_(record, ['파일ID']) === file.getId() &&
      getRecordValueByAliases_(record, ['처리상태']) === 'SUCCESS',
  );

  if (isSuccess) {
    throw appError_(
      'DUPLICATE_FILE',
      `이미 SUCCESS 처리된 파일입니다: ${file.getName()}`,
      'FILE_DUPLICATE_CHECK',
    );
  }
}

function checkDuplicateOrderItems(rows) {
  const seen = new Set();
  const duplicatesInFile = [];

  rows.forEach((row) => {
    const orderItemNumber = getTrimmedField_(row, '품목별 주문번호');
    if (!orderItemNumber) {
      return;
    }

    if (seen.has(orderItemNumber)) {
      duplicatesInFile.push(orderItemNumber);
    } else {
      seen.add(orderItemNumber);
    }
  });

  if (duplicatesInFile.length > 0) {
    throw appError_(
      'DUPLICATE_ORDER_ITEM_IN_FILE',
      `CSV 내부 품목별 주문번호 중복: ${[...new Set(duplicatesInFile)].join(', ')}`,
      'DUPLICATE_CHECK',
    );
  }

  const existingOrderItemNumbers = getExistingOrderItemNumbers_();
  const duplicatesInSheet = rows
    .map((row) => getTrimmedField_(row, '품목별 주문번호'))
    .filter((orderItemNumber) => existingOrderItemNumbers.has(orderItemNumber));

  if (duplicatesInSheet.length > 0) {
    throw appError_(
      'DUPLICATE_ORDER_ITEM',
      `이미 등록된 품목별 주문번호: ${[...new Set(duplicatesInSheet)].join(', ')}`,
      'DUPLICATE_CHECK',
    );
  }
}
