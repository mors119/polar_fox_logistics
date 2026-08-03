function setupSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const input = getOrCreateFolder_(CONFIG.properties.inputFolderId, CONFIG.folders.input);
    const processed = getOrCreateFolder_(
      CONFIG.properties.processedFolderId,
      CONFIG.folders.processed,
    );
    const error = getOrCreateFolder_(CONFIG.properties.errorFolderId, CONFIG.folders.error);

    ensureSheet_(CONFIG.sheets.products, PRODUCT_SHEET_HEADERS);
    ensureSheet_(CONFIG.sheets.errors, [
      '오류ID',
      '발생일시',
      '파일ID',
      '파일명',
      '처리단계',
      '행번호',
      '상품품목코드',
      '오류코드',
      '오류메시지',
      '처리상태',
    ]);
    ensureSheet_(CONFIG.sheets.history, [
      '파일ID',
      '파일명',
      '처리상태',
      '총행수',
      '등록행수',
      '오류건수',
      '처리시작',
      '처리종료',
      '메시지',
    ]);

    ensureTrigger_();

    const result = {
      inputFolderUrl: input.getUrl(),
      processedFolderUrl: processed.getUrl(),
      errorFolderUrl: error.getUrl(),
      spreadsheetUrl: SpreadsheetApp.getActiveSpreadsheet().getUrl(),
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateFolder_(propertyKey, folderName) {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(propertyKey);

  if (savedId) {
    try {
      return DriveApp.getFolderById(savedId);
    } catch (error) {
      console.warn(`기존 폴더 ID를 사용할 수 없습니다: ${propertyKey}`);
    }
  }

  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  properties.setProperty(propertyKey, folder.getId());
  return folder;
}

function ensureSheet_(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

function ensureTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === CONFIG.triggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(CONFIG.triggerHandler)
    .timeBased()
    .everyMinutes(CONFIG.triggerMinutes)
    .create();
}
