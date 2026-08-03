// 주문 처리 중 발생한 오류를 공용 오류 시트 포맷에 맞춰 기록한다.
function recordImportError(file, stage, error) {
  const sheet = ensureSheetContainsHeaders_(
    getSpreadsheet_(),
    ORDER_CONFIG.sheets.errors,
    ERROR_SHEET_HEADERS,
  );
  const headerMap = getHeaderIndexMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');

  setMappedCell_(row, headerMap, '오류ID', Utilities.getUuid());
  setMappedCell_(row, headerMap, '발생일시', new Date());
  setMappedCell_(row, headerMap, '파일ID', file ? file.getId() : '');
  setMappedCell_(row, headerMap, '파일명', file ? file.getName() : '');
  setMappedCell_(row, headerMap, '처리단계', stage || 'PROCESS');
  setMappedCell_(row, headerMap, '행번호', error.rowNumber || '');
  setMappedCell_(row, headerMap, '주문번호', error.orderNumber || '');
  setMappedCell_(row, headerMap, '품목별 주문번호', error.orderItemNumber || '');
  setMappedCell_(row, headerMap, '오류코드', error.code || 'UNKNOWN');
  setMappedCell_(row, headerMap, '오류메시지', error.message || '');
  setMappedCell_(row, headerMap, '처리상태', ORDER_CONFIG.defaultErrorStatus);

  appendRowsToSheet_(sheet, [row]);
}

// 주문 파일 처리가 시작되면 이력 시트에 PROCESSING 행을 먼저 만든다.
function startOrderFileHistory_(file, totalRows) {
  const sheet = ensureSheetContainsHeaders_(
    getSpreadsheet_(),
    ORDER_CONFIG.sheets.history,
    FILE_HISTORY_HEADERS,
  );
  const headerMap = getHeaderIndexMap_(sheet);
  const row = new Array(sheet.getLastColumn()).fill('');
  const startedAt = new Date();

  setMappedCell_(row, headerMap, '파일ID', file.getId());
  setMappedCell_(row, headerMap, '파일명', file.getName());
  setMappedCell_(row, headerMap, '처리상태', 'PROCESSING');
  setMappedCell_(row, headerMap, '총행수', totalRows);
  setMappedCell_(row, headerMap, '오류건수', 0);
  setMappedCell_(row, headerMap, '처리시작시각', startedAt);
  setMappedCell_(row, headerMap, '처리시작', startedAt);
  setMappedCell_(row, headerMap, '메시지', '주문 CSV 처리 시작');

  const writeResult = appendRowsToSheet_(sheet, [row]);

  return {
    rowNumber: writeResult.startRow,
    startedAt,
  };
}

// 처리 완료 후에는 시작 이력 행을 찾아 결과 값으로 갱신한다.
function finalizeOrderFileHistory_(file, context) {
  const sheet = ensureSheetContainsHeaders_(
    getSpreadsheet_(),
    ORDER_CONFIG.sheets.history,
    FILE_HISTORY_HEADERS,
  );
  const headerMap = getHeaderIndexMap_(sheet);
  const rowNumber = context.rowNumber || findHistoryRowByFileId_(sheet, file.getId());

  if (!rowNumber) {
    return;
  }

  setSheetCellByHeader_(sheet, rowNumber, headerMap, '처리상태', context.status);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '총행수', context.totalRows);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '주문등록수', context.orderCount);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '주문상품등록수', context.orderItemCount);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '등록행수', context.orderItemCount);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '오류건수', context.errorCount);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '처리종료시각', new Date());
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '처리종료', new Date());
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '메시지', context.message);
}

// 파일ID로 기존 이력 행 위치를 찾는다.
function findHistoryRowByFileId_(sheet, fileId) {
  const headerMap = getHeaderIndexMap_(sheet);
  const fileIdColumn = headerMap['파일ID'];

  if (!fileIdColumn || sheet.getLastRow() <= 1) {
    return 0;
  }

  const values = sheet.getRange(2, fileIdColumn, sheet.getLastRow() - 1, 1).getDisplayValues();
  for (let index = 0; index < values.length; index += 1) {
    if (String(values[index][0] || '').trim() === fileId) {
      return index + 2;
    }
  }

  return 0;
}

// 헤더명 기준으로 행 배열의 적절한 위치에 값을 채운다.
function setMappedCell_(row, headerMap, headerName, value) {
  const columnIndex = headerMap[headerName];
  if (columnIndex) {
    row[columnIndex - 1] = value;
  }
}

// 이미 존재하는 이력 행은 헤더명을 기준으로 필요한 셀만 갱신한다.
function setSheetCellByHeader_(sheet, rowNumber, headerMap, headerName, value) {
  const columnIndex = headerMap[headerName];
  if (columnIndex) {
    sheet.getRange(rowNumber, columnIndex).setValue(value);
  }
}
