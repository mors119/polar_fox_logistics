function setupOrderCsvSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const input = getOrCreateFolder_(
      ORDER_CONFIG.properties.inputFolderId,
      ORDER_CONFIG.folders.input
    );
    const processed = getOrCreateFolder_(
      ORDER_CONFIG.properties.processedFolderId,
      ORDER_CONFIG.folders.processed
    );
    const error = getOrCreateFolder_(
      ORDER_CONFIG.properties.errorFolderId,
      ORDER_CONFIG.folders.error
    );

    ensureSheet_(ORDER_CONFIG.sheets.orders, ORDER_SHEET_HEADERS);
    ensureSheet_(ORDER_CONFIG.sheets.orderItems, ORDER_ITEM_SHEET_HEADERS);
    ensureSheetContainsHeaders_(ORDER_CONFIG.sheets.errors, ERROR_SHEET_HEADERS);
    ensureSheetContainsHeaders_(ORDER_CONFIG.sheets.history, FILE_HISTORY_HEADERS);
    ensureOrderTrigger_();

    const result = {
      inputFolderUrl: input.getUrl(),
      processedFolderUrl: processed.getUrl(),
      errorFolderUrl: error.getUrl(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl()
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function ensureOrderTrigger_() {
  const hasTrigger = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === ORDER_CONFIG.triggerHandler
  );

  if (hasTrigger) {
    return;
  }

  ScriptApp.newTrigger(ORDER_CONFIG.triggerHandler)
    .timeBased()
    .everyMinutes(ORDER_CONFIG.triggerMinutes)
    .create();
}

function ensureSheetContainsHeaders_(sheetName, requiredHeaders) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const lastColumn = Math.max(sheet.getLastColumn(), requiredHeaders.length);
  const existingHeaders = lastColumn > 0
    ? sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(normalizeHeader_)
    : [];

  const mergedHeaders = existingHeaders.slice();
  requiredHeaders.forEach(header => {
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
