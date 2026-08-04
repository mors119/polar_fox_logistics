// 상품 CSV 처리에 필요한 폴더, 시트, 트리거를 한 번에 준비한다.
function setupSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const rootFolder = getRootFolder_();
    const spreadsheet = getOrCreateSpreadsheet_();
    const input = getOrCreateFolder_(CONFIG.properties.inputFolderId, CONFIG.folders.input);

    ensureSettingsSheet_(spreadsheet);

    // 상품 흐름은 초기화 시점에 필요한 시트 헤더를 강제로 맞춘다.
    ensureSheet_(spreadsheet, CONFIG.sheets.products, PRODUCT_SHEET_HEADERS);
    ensureSheet_(spreadsheet, CONFIG.sheets.errors, [
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
    ensureSheet_(spreadsheet, CONFIG.sheets.history, [
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
    SpreadsheetApp.flush();

    ensureTrigger_();

    const result = {
      rootFolderUrl: rootFolder.getUrl(),
      spreadsheetId: spreadsheet.getId(),
      inputFolderUrl: input.getUrl(),
      spreadsheetUrl: spreadsheet.getUrl(),
      sheetNames: spreadsheet.getSheets().map((sheet) => sheet.getName()),
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

// 모든 작업 폴더와 운영 스프레드시트를 담아둘 상위 Drive 폴더를 가져온다.
function getRootFolder_() {
  const rootFolderId = PropertiesService.getScriptProperties().getProperty(
    CONFIG.properties.rootFolderId,
  );

  if (!rootFolderId) {
    throw new Error('ROOT_FOLDER_ID script property를 먼저 설정하세요.');
  }

  return DriveApp.getFolderById(rootFolderId);
}

// 운영용 스프레드시트를 가져오거나, 없으면 새로 만든 뒤 상위 폴더 아래로 옮긴다.
function getOrCreateSpreadsheet_() {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(CONFIG.properties.spreadsheetId);

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      console.warn(`기존 스프레드시트 ID를 사용할 수 없습니다: ${CONFIG.properties.spreadsheetId}`);
    }
  }

  const spreadsheet = SpreadsheetApp.create(CONFIG.spreadsheetName);
  moveFileToRootFolder_(DriveApp.getFileById(spreadsheet.getId()));
  properties.setProperty(CONFIG.properties.spreadsheetId, spreadsheet.getId());
  return spreadsheet;
}

// Script Properties에 저장된 폴더 ID가 있으면 재사용하고, 없으면 상위 폴더 아래에 새 폴더를 만든다.
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

  const rootFolder = getRootFolder_();
  const folders = rootFolder.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : rootFolder.createFolder(folderName);

  properties.setProperty(propertyKey, folder.getId());
  return folder;
}

// 새로 만든 파일이 있으면 지정된 상위 폴더 아래로 옮기고, 내 Drive 루트에서는 제거한다.
function moveFileToRootFolder_(file) {
  const rootFolder = getRootFolder_();
  rootFolder.addFile(file);

  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    console.warn(`루트 폴더에서 파일 제거를 건너뜁니다: ${file.getName()}`);
  }
}

// 운영 스프레드시트에서 시트를 찾고, 없으면 생성한 뒤 헤더를 덮어쓴다.
function ensureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
}

// 기본 빈 탭이 있으면 설정 시트로 재사용하고, 없으면 새로 만든다.
function getOrCreateSettingsSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(CONFIG.sheets.settings);

  if (sheet) {
    return sheet;
  }

  sheet = spreadsheet.getSheetByName('시트1') || spreadsheet.getSheetByName('Sheet1');

  if (sheet) {
    sheet.setName(CONFIG.sheets.settings);
    return sheet;
  }

  return spreadsheet.insertSheet(CONFIG.sheets.settings, 0);
}

// 설정 시트에는 백업 관련 입력 행을 만들고, 기존 설정값은 유지한다.
function ensureSettingsSheet_(spreadsheet) {
  const sheet = getOrCreateSettingsSheet_(spreadsheet);
  const headerRow = ['설정 항목', '설정 값', '설명'];
  const lastRow = sheet.getLastRow();
  const existingRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 3).getValues() : [];
  const rowMap = {};

  existingRows.forEach((row, index) => {
    const key = String(row[0] || '').trim();
    if (key) {
      rowMap[key] = {
        rowNumber: index + 2,
        value: row[1],
      };
    }
  });

  sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
  sheet.setFrozenRows(1);

  SETTINGS_SHEET_ROWS.forEach(([key, defaultValue, description]) => {
    const existing = rowMap[key];

    if (existing) {
      sheet
        .getRange(existing.rowNumber, 1, 1, 3)
        .setValues([[key, existing.value || defaultValue, description]]);
      return;
    }

    sheet.appendRow([key, defaultValue, description]);
  });

  sheet.autoResizeColumns(1, 3);
  return sheet;
}

// 이후 모든 시트 접근은 저장된 운영 스프레드시트 ID 기준으로 수행한다.
function getSpreadsheet_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty(
    CONFIG.properties.spreadsheetId,
  );

  if (!spreadsheetId) {
    throw new Error('OPERATIONS_SPREADSHEET_ID가 없습니다. setupSystem()을 먼저 실행하세요.');
  }

  return SpreadsheetApp.openById(spreadsheetId);
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
