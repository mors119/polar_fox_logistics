// 주문 CSV 처리에 필요한 폴더, 시트, 트리거를 한 번에 준비한다.
function setupOrderCsvSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const rootFolder = getRootFolder_();
    const spreadsheet = getOrCreateSpreadsheet_();
    const input = getOrCreateFolder_(
      ORDER_CONFIG.properties.inputFolderId,
      ORDER_CONFIG.folders.input,
    );

    // 주문 시트는 고정 헤더로 만들고, 공용 시트는 필요한 헤더를 덧붙이는 방식으로 보정한다.
    ensureSheet_(spreadsheet, ORDER_CONFIG.sheets.orders, ORDER_SHEET_HEADERS);
    ensureSheet_(spreadsheet, ORDER_CONFIG.sheets.orderItems, ORDER_ITEM_SHEET_HEADERS);
    ensureSheetContainsHeaders_(spreadsheet, ORDER_CONFIG.sheets.errors, ERROR_SHEET_HEADERS);
    ensureSheetContainsHeaders_(spreadsheet, ORDER_CONFIG.sheets.history, FILE_HISTORY_HEADERS);
    ensureOrderTrigger_();

    const result = {
      rootFolderUrl: rootFolder.getUrl(),
      spreadsheetId: spreadsheet.getId(),
      inputFolderUrl: input.getUrl(),
      spreadsheetUrl: spreadsheet.getUrl(),
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

// 주문 트리거는 이미 있으면 그대로 두고, 없을 때만 추가한다.
function ensureOrderTrigger_() {
  const hasTrigger = ScriptApp.getProjectTriggers().some(
    (trigger) => trigger.getHandlerFunction() === ORDER_CONFIG.triggerHandler,
  );

  if (hasTrigger) {
    return;
  }

  ScriptApp.newTrigger(ORDER_CONFIG.triggerHandler)
    .timeBased()
    .everyMinutes(ORDER_CONFIG.triggerMinutes)
    .create();
}

// 공용 오류/이력 시트는 기존 헤더를 보존하면서 필요한 컬럼만 추가한다.
function ensureSheetContainsHeaders_(spreadsheet, sheetName, requiredHeaders) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  const existingHeaders =
    lastColumn > 0
      ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(normalizeHeader_)
      : [];

  const mergedHeaders = existingHeaders.slice();
  requiredHeaders.forEach((header) => {
    if (!mergedHeaders.includes(header)) {
      mergedHeaders.push(header);
    }
  });

  if (mergedHeaders.length === 0) {
    mergedHeaders.push(...requiredHeaders);
  }

  sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
  sheet.setFrozenRows(1);
  return sheet;
}
