function assertFileNotProcessed_(file) {
  const sheet = getSheet_(CONFIG.sheets.history);

  if (sheet.getLastRow() <= 1) {
    return;
  }

  const ids = sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 1)
    .getDisplayValues()
    .flat();

  if (ids.includes(file.getId())) {
    throw appError_(
      "DUPLICATE_FILE",
      `이미 처리된 파일입니다: ${file.getName()}`,
      "FILE_DUPLICATE_CHECK"
    );
  }
}

function appendHistory_(file, data) {
  getSheet_(CONFIG.sheets.history).appendRow([
    file.getId(),
    file.getName(),
    data.status,
    data.totalRows,
    data.importedRows,
    data.errorCount,
    data.startedAt,
    new Date(),
    data.message
  ]);
}

function appendErrorLog_(file, stage, error) {
  getSheet_(CONFIG.sheets.errors).appendRow([
    Utilities.getUuid(),
    new Date(),
    file ? file.getId() : "",
    file ? file.getName() : "",
    stage,
    error.rowNumber || "",
    error.productCode || "",
    error.code || "UNKNOWN",
    error.message || "",
    "미처리"
  ]);
}

function moveFile_(file, propertyKey) {
  file.moveTo(getConfiguredFolder_(propertyKey));
}

function getSheet_(sheetName) {
  const sheet = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`시트가 없습니다: ${sheetName}`);
  }

  return sheet;
}

function appError_(code, message, stage) {
  const error = new Error(message);
  error.code = code;
  error.stage = stage;
  return error;
}
