// 같은 파일 ID가 이미 이력 시트에 있으면 중복 처리로 본다.
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
      'DUPLICATE_FILE',
      `이미 처리된 파일입니다: ${file.getName()}`,
      'FILE_DUPLICATE_CHECK',
    );
  }
}

// 상품 파일 처리 결과는 파일 단위 이력으로 남긴다.
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
    data.message,
  ]);
}

// 행 오류든 파일 오류든 공통 포맷으로 오류 시트에 적재한다.
function appendErrorLog_(file, stage, error) {
  getSheet_(CONFIG.sheets.errors).appendRow([
    Utilities.getUuid(),
    new Date(),
    file ? file.getId() : '',
    file ? file.getName() : '',
    stage,
    error.rowNumber || '',
    error.productCode || '',
    error.code || 'UNKNOWN',
    error.message || '',
    '미처리',
  ]);
}

// 처리 결과에 따라 지정된 폴더로 파일을 이동시킨다.
function moveFile_(file, propertyKey) {
  file.moveTo(getConfiguredFolder_(propertyKey));
}

// 현재 바인드된 스프레드시트에서 시트를 가져오는 공통 함수다.
function getSheet_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`시트가 없습니다: ${sheetName}`);
  }

  return sheet;
}

// stage와 code를 함께 담는 커스텀 에러 객체를 만든다.
function appError_(code, message, stage) {
  const error = new Error(message);
  error.code = code;
  error.stage = stage;
  return error;
}
