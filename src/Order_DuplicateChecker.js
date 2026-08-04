// 같은 파일이 SUCCESS로 처리된 이력이 있으면 재처리하지 않는다.
function checkDuplicateFile(file) {
  const sheet = ensureSheetContainsHeaders_(
    getSpreadsheet_(),
    ORDER_CONFIG.sheets.history,
    FILE_HISTORY_HEADERS,
  );
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

// 기존 주문 시트에 이미 있는 주문번호는 다시 적재하지 않도록 막는다.
function checkDuplicateOrders(rows) {
  const existingOrderNumbers = getExistingOrderNumbers_();
  const duplicatesInSheet = rows
    .map((row) => getTrimmedField_(row, '주문번호'))
    .filter((orderNumber) => orderNumber && existingOrderNumbers.has(orderNumber));

  if (duplicatesInSheet.length > 0) {
    throw appError_(
      'DUPLICATE_ORDER',
      `이미 등록된 주문번호: ${[...new Set(duplicatesInSheet)].join(', ')}`,
      'DUPLICATE_CHECK',
    );
  }
}
