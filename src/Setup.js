// 상품 CSV 처리에 필요한 폴더, 시트, 트리거를 한 번에 준비한다.
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

    // 상품 흐름은 초기화 시점에 필요한 시트 헤더를 강제로 맞춘다.
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

// Script Properties에 저장된 폴더 ID가 있으면 재사용하고, 없으면 새 폴더를 만든다.
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

// 바인드된 스프레드시트에서 시트를 찾고, 없으면 생성한 뒤 헤더를 덮어쓴다.
function ensureSheet_(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

// 상품 CSV 스캔 트리거는 중복 생성되지 않도록 기존 것을 지우고 다시 만든다.
function ensureTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === CONFIG.triggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(CONFIG.triggerHandler)
    .timeBased()
    .everyMinutes(CONFIG.triggerMinutes)
    .create();
}
