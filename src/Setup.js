// 상품/주문 CSV 처리에 필요한 폴더, 시트, 트리거를 한 번에 준비한다.
function setupSystem() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const warnings = [];
    const rootFolder = getRootFolder_();
    const legacySpreadsheets = getLegacySpreadsheetsForMigration_();
    const spreadsheets = getOrCreateSystemSpreadsheets_();
    const adminSpreadsheet = spreadsheets.admin;
    const workerSpreadsheet = spreadsheets.worker;
    const inputFolder = getOrCreateFolder_(CONFIG.properties.inputFolderId, CONFIG.folders.input);
    const successFolder = getOrCreateFolder_(
      CONFIG.properties.successFolderId,
      CONFIG.folders.success,
    );
    const errorFolder = getOrCreateFolder_(CONFIG.properties.errorFolderId, CONFIG.folders.error);

    seedSystemSheetsFromLegacy_(spreadsheets, legacySpreadsheets);
    ensureSettingsSheet_(adminSpreadsheet);

    // 원본·설정·대시보드는 관리자용, 입고·피킹은 업무인원용 파일에 만든다.
    ensureSheetWithMappedHeaders_(adminSpreadsheet, CONFIG.sheets.products, PRODUCT_SHEET_HEADERS);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.inventoryHistory, INVENTORY_HISTORY_HEADERS);
    ensureSheet_(adminSpreadsheet, ORDER_CONFIG.sheets.orders, ORDER_SHEET_HEADERS);
    ensureSheet_(adminSpreadsheet, ORDER_CONFIG.sheets.orderItems, ORDER_ITEM_SHEET_HEADERS);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.errors, ERROR_SHEET_HEADERS);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.history, FILE_HISTORY_HEADERS);
    ensureSheetContainsHeaders_(adminSpreadsheet, ORDER_CONFIG.sheets.errors, ERROR_SHEET_HEADERS);
    ensureSheetContainsHeaders_(
      adminSpreadsheet,
      ORDER_CONFIG.sheets.history,
      FILE_HISTORY_HEADERS,
    );

    ensureSheet_(
      workerSpreadsheet,
      CONFIG.sheets.productRegistration,
      PRODUCT_REGISTRATION_HEADERS,
    );
    ensureSheet_(workerSpreadsheet, CONFIG.sheets.inboundPending, INBOUND_WORK_HEADERS);
    ensureSheet_(workerSpreadsheet, CONFIG.sheets.inboundCompleted, INBOUND_WORK_HEADERS);
    ensureSheet_(workerSpreadsheet, CONFIG.sheets.inboundErrors, INBOUND_WORK_HEADERS);

    ensureSheetWithMappedHeaders_(
      workerSpreadsheet,
      CONFIG.sheets.pickingHeaders,
      PICKING_HEADER_HEADERS,
    );
    ensureSheetWithMappedHeaders_(
      workerSpreadsheet,
      CONFIG.sheets.pickingLines,
      PICKING_LINE_HEADERS,
    );

    ensureSheet_(adminSpreadsheet, CONFIG.sheets.inventoryDashboard, ['📊  재고 현황']);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.orderDashboard, ['📊  주문 현황']);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.pickingDashboard, ['📦  피킹 현황']);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.crossCheckDashboard, ['🔗  교차검증']);
    ensureSheet_(adminSpreadsheet, CONFIG.sheets.completedOrders, LATEST_COMPLETED_ORDER_HEADERS);

    applyInboundWorkflowFormats_(adminSpreadsheet, workerSpreadsheet);
    applyPickingWorkflowFormats_(workerSpreadsheet);
    Object.values(spreadsheets).forEach((spreadsheet) => applyOperationsSheetUi_(spreadsheet));
    migrateInventoryModel_();
    SpreadsheetApp.flush();
    runSetupTask_(() => refreshOperationsDashboards_(), warnings, '운영 대시보드 생성');
    Object.values(spreadsheets).forEach((spreadsheet) => removeUnusedDefaultSheets_(spreadsheet));
    runSetupTask_(
      () =>
        protectSystemSpreadsheet_(adminSpreadsheet, '관리자 데이터 보호', [CONFIG.sheets.settings]),
      warnings,
      '관리자 데이터 보호',
    );
    runSetupTask_(
      () => ensureOrderEditTrigger_(adminSpreadsheet),
      warnings,
      '주문 체크박스 편집 트리거 생성',
    );

    runSetupTask_(() => ensureTrigger_(), warnings, '입력 스캔 트리거 생성');
    runSetupTask_(() => ensurePickingTrigger_(), warnings, '피킹 반영 트리거 생성');
    runSetupTask_(() => ensureConfiguredBackupTrigger_(), warnings, '백업 트리거 생성');

    const result = {
      rootFolderUrl: rootFolder.getUrl(),
      spreadsheetId: adminSpreadsheet.getId(),
      files: Object.keys(spreadsheets).reduce((result, group) => {
        result[group] = {
          id: spreadsheets[group].getId(),
          name: spreadsheets[group].getName(),
          url: spreadsheets[group].getUrl(),
          sheets: spreadsheets[group].getSheets().map((sheet) => sheet.getName()),
        };
        return result;
      }, {}),
      inputFolderUrl: inputFolder.getUrl(),
      successFolderUrl: successFolder.getUrl(),
      errorFolderUrl: errorFolder.getUrl(),
      spreadsheetUrl: adminSpreadsheet.getUrl(),
      sheetNames: adminSpreadsheet.getSheets().map((sheet) => sheet.getName()),
      warnings,
    };

    console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    lock.releaseLock();
  }
}

// setup 중 시트 생성은 계속 진행하고, 트리거나 설정 오류는 경고로만 수집한다.
function runSetupTask_(fn, warnings, label) {
  try {
    return fn();
  } catch (error) {
    const message = `${label} 실패: ${error.message || String(error)}`;
    console.warn(message);
    warnings.push(message);
    return null;
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

// 과거 통합 파일과 4파일 구조는 2파일 구조의 데이터 원본으로만 읽는다.
function getLegacySpreadsheetsForMigration_() {
  const properties = PropertiesService.getScriptProperties();
  const propertyKeys = [
    CONFIG.properties.spreadsheetId,
    CONFIG.properties.mainSpreadsheetId,
    CONFIG.properties.inboundSpreadsheetId,
    CONFIG.properties.pickingSpreadsheetId,
    CONFIG.properties.dashboardSpreadsheetId,
  ];
  const openedIds = new Set();

  return propertyKeys.reduce((spreadsheets, propertyKey) => {
    const spreadsheetId = properties.getProperty(propertyKey);
    if (!spreadsheetId || openedIds.has(spreadsheetId)) return spreadsheets;
    openedIds.add(spreadsheetId);
    try {
      spreadsheets.push(SpreadsheetApp.openById(spreadsheetId));
    } catch (error) {
      console.warn(`기존 스프레드시트를 열 수 없습니다: ${propertyKey}`);
    }
    return spreadsheets;
  }, []);
}

function getOrCreateSystemSpreadsheets_() {
  const spreadsheets = {};
  Object.keys(CONFIG.spreadsheetFiles).forEach((group) => {
    spreadsheets[group] = getOrCreateSpreadsheetFile_(
      SPREADSHEET_GROUP_PROPERTIES[group],
      CONFIG.spreadsheetFiles[group],
    );
  });
  PropertiesService.getScriptProperties().setProperty(
    CONFIG.properties.spreadsheetId,
    spreadsheets.admin.getId(),
  );
  return spreadsheets;
}

// 운영용 스프레드시트를 가져오거나, 없으면 실제 Drive 파일로 생성한다.
function getOrCreateSpreadsheetFile_(propertyKey, spreadsheetName) {
  const properties = PropertiesService.getScriptProperties();
  const savedId = properties.getProperty(propertyKey);

  if (savedId) {
    try {
      const spreadsheet = SpreadsheetApp.openById(savedId);
      ensureFileInRootFolder_(DriveApp.getFileById(spreadsheet.getId()));
      return spreadsheet;
    } catch (error) {
      console.warn(`기존 스프레드시트 ID를 사용할 수 없습니다: ${propertyKey}`);
    }
  }

  const existingSpreadsheet = findRootSpreadsheetByName_(spreadsheetName);
  if (existingSpreadsheet) {
    properties.setProperty(propertyKey, existingSpreadsheet.getId());
    ensureFileInRootFolder_(DriveApp.getFileById(existingSpreadsheet.getId()));
    return existingSpreadsheet;
  }

  const spreadsheet = SpreadsheetApp.create(spreadsheetName);
  ensureFileInRootFolder_(DriveApp.getFileById(spreadsheet.getId()));
  properties.setProperty(propertyKey, spreadsheet.getId());
  return spreadsheet;
}

function findRootSpreadsheetByName_(spreadsheetName) {
  const files = getRootFolder_().getFilesByName(spreadsheetName);

  while (files.hasNext()) {
    const file = files.next();

    if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.openById(file.getId());
    }
  }

  return null;
}

function seedSystemSheetsFromLegacy_(spreadsheets, legacySpreadsheets) {
  if (!legacySpreadsheets || legacySpreadsheets.length === 0) return;
  const sheetGroups = {
    admin: [
      CONFIG.sheets.settings,
      CONFIG.sheets.products,
      CONFIG.sheets.inventoryHistory,
      ORDER_CONFIG.sheets.orders,
      ORDER_CONFIG.sheets.orderItems,
      CONFIG.sheets.errors,
      CONFIG.sheets.history,
      CONFIG.sheets.completedOrders,
    ],
    worker: [
      CONFIG.sheets.productRegistration,
      CONFIG.sheets.inboundPending,
      CONFIG.sheets.inboundCompleted,
      CONFIG.sheets.inboundErrors,
      CONFIG.sheets.pickingHeaders,
      CONFIG.sheets.pickingLines,
    ],
  };
  Object.keys(sheetGroups).forEach((group) => {
    sheetGroups[group].forEach((sheetName) => {
      legacySpreadsheets.some((legacySpreadsheet) => {
        if (spreadsheets[group].getId() === legacySpreadsheet.getId()) return false;
        return seedSheetFromLegacy_(spreadsheets[group], legacySpreadsheet, sheetName);
      });
    });
  });
}

function seedSheetFromLegacy_(targetSpreadsheet, legacySpreadsheet, sheetName) {
  const sourceSheet = legacySpreadsheet.getSheetByName(sheetName);
  if (!sourceSheet || sourceSheet.getLastRow() === 0 || sourceSheet.getLastColumn() === 0) {
    return false;
  }
  let targetSheet = targetSpreadsheet.getSheetByName(sheetName);
  if (targetSheet && targetSheet.getLastRow() > 1) return true;
  if (!targetSheet) targetSheet = targetSpreadsheet.insertSheet(sheetName);
  const values = sourceSheet
    .getRange(1, 1, sourceSheet.getLastRow(), sourceSheet.getLastColumn())
    .getValues();
  ensureSheetSize_(targetSheet, values.length, values[0].length);
  targetSheet.clearContents();
  targetSheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  return true;
}

function ensureSheetSize_(sheet, rowCount, columnCount) {
  if (sheet.getMaxRows() < rowCount) {
    sheet.insertRowsAfter(sheet.getMaxRows(), rowCount - sheet.getMaxRows());
  }
  if (sheet.getMaxColumns() < columnCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), columnCount - sheet.getMaxColumns());
  }
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
function ensureFileInRootFolder_(file) {
  const rootFolder = getRootFolder_();
  let hasRootParent = false;
  const parents = file.getParents();

  while (parents.hasNext()) {
    const parent = parents.next();

    if (parent.getId() === rootFolder.getId()) {
      hasRootParent = true;
      break;
    }
  }

  if (!hasRootParent) {
    rootFolder.addFile(file);
  }

  try {
    DriveApp.getRootFolder().removeFile(file);
  } catch (error) {
    console.warn(`루트 폴더에서 파일 제거를 건너뜁니다: ${file.getName()}`);
  }
}

// SpreadsheetApp.create()가 만든 기본 빈 탭은 실제 업무 탭 생성 뒤 제거한다.
function removeUnusedDefaultSheets_(spreadsheet) {
  const defaultSheetNames = ['시트1', 'Sheet1'];
  spreadsheet
    .getSheets()
    .filter(
      (sheet) =>
        defaultSheetNames.includes(sheet.getName()) &&
        sheet.getLastRow() === 0 &&
        spreadsheet.getSheets().length > 1,
    )
    .forEach((sheet) => spreadsheet.deleteSheet(sheet));
}

// 메인/대시보드는 실행 계정만 수정하고 작업자는 조회만 하도록 시트 보호를 건다.
function protectSystemSpreadsheet_(spreadsheet, description, editableSheetNames) {
  const executorEmail = getWorkflowExecutorEmail_();
  const excludedNames = editableSheetNames || [];

  spreadsheet
    .getSheets()
    .filter((sheet) => !excludedNames.includes(sheet.getName()))
    .forEach((sheet) => {
      let protection = sheet
        .getProtections(SpreadsheetApp.ProtectionType.SHEET)
        .find((item) => item.getDescription() === description);

      if (!protection) {
        protection = sheet.protect().setDescription(description);
      }

      protection.setWarningOnly(false);
      if (executorEmail) {
        protection.addEditor(executorEmail);
        const otherEditors = protection
          .getEditors()
          .filter((editor) => editor.getEmail() !== executorEmail);
        if (otherEditors.length > 0) protection.removeEditors(otherEditors);
      }
      if (protection.canDomainEdit()) protection.setDomainEdit(false);
    });
}

// 운영 스프레드시트에서 시트를 찾고, 없으면 생성한 뒤 헤더를 덮어쓴다.
function ensureSheet_(spreadsheet, sheetName, headers) {
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const normalizedHeaders = uniqueOrderedHeaders_(headers);
  const lastColumn = Math.max(sheet.getLastColumn(), normalizedHeaders.length);

  if (lastColumn > 0) {
    sheet.getRange(1, 1, 1, lastColumn).clearContent();
  }

  sheet.getRange(1, 1, 1, normalizedHeaders.length).setValues([normalizedHeaders]);
  sheet.setFrozenRows(1);
}

// 최신 상품마스터 컬럼 순서로 바꾸되 기존 값은 헤더 별칭을 기준으로 안전하게 옮긴다.
function ensureSheetWithMappedHeaders_(spreadsheet, sheetName, targetHeaders) {
  let sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) {
    ensureSheet_(spreadsheet, sheetName, targetHeaders);
    return;
  }

  const sourceHeaders = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0]
    .map(normalizeHeader_);
  if (
    sourceHeaders.length === targetHeaders.length &&
    sourceHeaders.every((header, index) => header === targetHeaders[index])
  ) {
    ensureSheet_(spreadsheet, sheetName, targetHeaders);
    return;
  }

  const sourceValues =
    sheet.getLastRow() > 1
      ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues()
      : [];
  const mappedValues = mapSheetValuesByHeaders_(sourceHeaders, sourceValues, targetHeaders);

  if (sheet.getMaxColumns() < targetHeaders.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), targetHeaders.length - sheet.getMaxColumns());
  }
  try {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    if (mappedValues.length > 0) {
      sheet.getRange(2, 1, mappedValues.length, targetHeaders.length).setValues(mappedValues);
    }
  } catch (error) {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, sourceHeaders.length).setValues([sourceHeaders]);
    if (sourceValues.length > 0) {
      sheet.getRange(2, 1, sourceValues.length, sourceHeaders.length).setValues(sourceValues);
    }
    throw error;
  }
  sheet.setFrozenRows(1);
}

function mapSheetValuesByHeaders_(sourceHeaders, sourceValues, targetHeaders) {
  const sourceIndexByHeader = {};
  sourceHeaders.map(normalizeHeader_).forEach((header, index) => {
    if (header) sourceIndexByHeader[header] = index;
  });
  const targetSourceIndexes = targetHeaders.map((header) => {
    const aliases = getSheetHeaderAliasGroup_(header) || [header];
    const matchedHeader = [header, ...aliases].find(
      (candidate) => sourceIndexByHeader[candidate] !== undefined,
    );
    return matchedHeader === undefined ? -1 : sourceIndexByHeader[matchedHeader];
  });
  return sourceValues.map((row) =>
    targetSourceIndexes.map((sourceIndex) => (sourceIndex >= 0 ? row[sourceIndex] : '')),
  );
}

// 상품코드·바코드의 앞자리 0을 보존하고 날짜·수량 표시를 통일한다.
function applyInboundWorkflowFormats_(mainSpreadsheet, inboundSpreadsheet) {
  const productSheet = mainSpreadsheet.getSheetByName(CONFIG.sheets.products);
  const registrationSheet = inboundSpreadsheet.getSheetByName(CONFIG.sheets.productRegistration);
  const workSheets = [
    inboundSpreadsheet.getSheetByName(CONFIG.sheets.inboundPending),
    inboundSpreadsheet.getSheetByName(CONFIG.sheets.inboundCompleted),
    inboundSpreadsheet.getSheetByName(CONFIG.sheets.inboundErrors),
  ];

  applyFormatsByHeader_(productSheet, ['상품품목코드', '내부SKU', '재고코드', '관리코드'], '@');
  applyFormatsByHeader_(
    productSheet,
    ['가용재고', '예약재고', '불량재고', '안전재고', '적정재고', '출고후잔량'],
    '#,##0',
  );
  applyFormatsByHeader_(productSheet, ['등록일', '유효기간'], 'yyyy-mm-dd');

  applyFormatsByHeader_(registrationSheet, ['상품품목코드', '코드', '바코드'], '@');
  applyFormatsByHeader_(registrationSheet, ['유효기간'], 'yyyy-mm-dd');
  applyFormatsByHeader_(registrationSheet, ['안전재고', '적정재고', '박스수량'], '#,##0');

  workSheets.forEach((sheet) => {
    applyFormatsByHeader_(sheet, ['상품품목코드', '코드', '바코드'], '@');
    applyFormatsByHeader_(sheet, ['입고예정일', '실제입고일', '유효기간'], 'yyyy-mm-dd');
    applyFormatsByHeader_(
      sheet,
      ['입고예정수량', '실제입고수량', '정상수량', '불량수량', '부족수량', '초과수량'],
      '#,##0',
    );
  });
}

function applyPickingWorkflowFormats_(spreadsheet) {
  const headerSheet = spreadsheet.getSheetByName(CONFIG.sheets.pickingHeaders);
  const lineSheet = spreadsheet.getSheetByName(CONFIG.sheets.pickingLines);
  if (!lineSheet) return;

  if (headerSheet) {
    const headerMap = getHeaderIndexMap_(headerSheet);
    const headerRowCount = Math.max(headerSheet.getMaxRows() - 1, 1);
    if (headerMap['상태']) {
      const statusRule = SpreadsheetApp.newDataValidation()
        .requireValueInList(['대기', '진행', '완료', '예외'], true)
        .setAllowInvalid(false)
        .build();
      headerSheet.getRange(2, headerMap['상태'], headerRowCount, 1).setDataValidation(statusRule);
    }
  }

  applyFormatsByHeader_(lineSheet, ['품목별 주문번호', '주문번호', '상품품목코드'], '@');
  const headerMap = getHeaderIndexMap_(lineSheet);
  const rowCount = Math.max(lineSheet.getMaxRows() - 1, 1);
  if (headerMap['확인']) {
    const confirmationRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['O', 'X'], true)
      .setAllowInvalid(false)
      .build();
    lineSheet.getRange(2, headerMap['확인'], rowCount, 1).setDataValidation(confirmationRule);
  }
  if (headerMap['예외사유']) {
    const reasonRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['재고없음', '불량재고', '상품불일치', '기타'], true)
      .setAllowInvalid(true)
      .build();
    lineSheet.getRange(2, headerMap['예외사유'], rowCount, 1).setDataValidation(reasonRule);
  }
  if (typeof applyPickingWorkSheetUi_ === 'function') {
    applyPickingWorkSheetUi_(headerSheet, lineSheet);
  }
}

function applyFormatsByHeader_(sheet, headers, numberFormat) {
  if (!sheet) {
    return;
  }

  const headerMap = getHeaderIndexMap_(sheet);
  const rowCount = Math.max(sheet.getMaxRows() - 1, 1);
  headers.forEach((header) => {
    if (headerMap[header]) {
      sheet.getRange(2, headerMap[header], rowCount, 1).setNumberFormat(numberFormat);
    }
  });
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

  const legacyTriggerValue =
    (rowMap['상품 트리거 분'] && rowMap['상품 트리거 분'].value) ||
    (rowMap['주문 트리거 분'] && rowMap['주문 트리거 분'].value);

  SETTINGS_SHEET_ROWS.forEach(([key, defaultValue, description]) => {
    const existing = rowMap[key];

    if (existing) {
      sheet
        .getRange(existing.rowNumber, 1, 1, 3)
        .setValues([[key, existing.value || defaultValue, description]]);
      return;
    }

    const migratedDefault =
      key === CONFIG.settingsKeys.inputTriggerMinutes && legacyTriggerValue
        ? legacyTriggerValue
        : defaultValue;
    sheet.appendRow([key, migratedDefault, description]);
  });

  // 구 버전의 상품/주문 전용 트리거 설정은 공통 입력 설정으로 값을 옮긴 뒤 제거한다.
  ['상품 트리거 분', '주문 트리거 분']
    .map((key) => rowMap[key] && rowMap[key].rowNumber)
    .filter(Boolean)
    .sort((left, right) => right - left)
    .forEach((rowNumber) => sheet.deleteRow(rowNumber));

  sheet.autoResizeColumns(1, 3);
  applySettingsSheetFormats_(sheet);
  return sheet;
}

// 설정 시트의 입력 셀은 용도에 맞는 표시 형식으로 맞춰 사용자가 헷갈리지 않게 한다.
function applySettingsSheetFormats_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return;
  }

  const labels = sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getDisplayValues()
    .flat();

  labels.forEach((label, index) => {
    const rowNumber = index + 2;

    if (
      label === CONFIG.settingsKeys.operatingStartTime ||
      label === CONFIG.settingsKeys.operatingEndTime ||
      label === CONFIG.settingsKeys.backupTime
    ) {
      sheet.getRange(rowNumber, 2).setNumberFormat('HH:mm');
    }
  });
}

function getSpreadsheetByGroup_(group) {
  const propertyKey = SPREADSHEET_GROUP_PROPERTIES[group];
  if (!propertyKey) throw new Error(`알 수 없는 스프레드시트 그룹입니다: ${group}`);
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId =
    properties.getProperty(propertyKey) ||
    (group === 'admin' ? properties.getProperty(CONFIG.properties.spreadsheetId) : '');

  if (!spreadsheetId) {
    throw new Error(`${propertyKey}가 없습니다. setupSystem()을 먼저 실행하세요.`);
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function getSpreadsheetForSheet_(sheetName) {
  const group = SHEET_SPREADSHEET_GROUPS[sheetName];
  if (!group) throw new Error(`시트 파일 그룹이 설정되지 않았습니다: ${sheetName}`);
  return getSpreadsheetByGroup_(group);
}

// 기존 공통 호출은 관리자용 파일을 반환한다.
function getSpreadsheet_() {
  return getSpreadsheetByGroup_('admin');
}

// 상품/주문 공통 스캔 트리거는 기존 전용 트리거까지 정리하고 하나만 생성한다.
function ensureTrigger_() {
  const settings = getSettingsMap_();
  const triggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.inputTriggerMinutes],
    CONFIG.triggerMinutes,
    CONFIG.settingsKeys.inputTriggerMinutes,
  );
  const legacyHandlers = ['scanCsvInputFolder', 'scanOrderFolder'];

  ScriptApp.getProjectTriggers()
    .filter((trigger) =>
      [CONFIG.triggerHandler, ...legacyHandlers].includes(trigger.getHandlerFunction()),
    )
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(CONFIG.triggerHandler).timeBased().everyMinutes(triggerMinutes).create();
}

// standalone 프로젝트에서도 주문상품 체크박스 편집을 잡기 위해 설치형 onEdit 트리거를 만든다.
function ensureOrderEditTrigger_(spreadsheet) {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === ORDER_CONFIG.editTriggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(ORDER_CONFIG.editTriggerHandler)
    .forSpreadsheet(spreadsheet)
    .onEdit()
    .create();
}

function ensurePickingTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === CONFIG.pickingTriggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  const settings = getSettingsMap_();
  const triggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.pickingTriggerMinutes],
    5,
    CONFIG.settingsKeys.pickingTriggerMinutes,
  );
  ScriptApp.newTrigger(CONFIG.pickingTriggerHandler)
    .timeBased()
    .everyMinutes(triggerMinutes)
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

  const mergedHeaders = uniqueOrderedHeaders_(existingHeaders);
  uniqueOrderedHeaders_(requiredHeaders).forEach((header) => {
    if (!mergedHeaders.includes(header)) {
      mergedHeaders.push(header);
    }
  });

  if (mergedHeaders.length === 0) {
    mergedHeaders.push(...uniqueOrderedHeaders_(requiredHeaders));
  }

  if (lastColumn > 0) {
    sheet.getRange(1, 1, 1, lastColumn).clearContent();
  }

  sheet.getRange(1, 1, 1, mergedHeaders.length).setValues([mergedHeaders]);
  sheet.setFrozenRows(1);
  return sheet;
}

// 헤더는 순서를 유지하면서 중복과 빈 값을 제거한다.
function uniqueOrderedHeaders_(headers) {
  const seen = new Set();
  const result = [];

  (headers || []).forEach((header) => {
    const normalized = normalizeHeader_(header);

    if (!normalized || seen.has(normalized)) {
      return;
    }

    seen.add(normalized);
    result.push(normalized);
  });

  return result;
}

// 설정 시트의 백업 요일/시간 값을 읽어 메일 백업 트리거를 다시 맞춘다.
function ensureConfiguredBackupTrigger_() {
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === CONFIG.backupTriggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  const settings = getSettingsMap_();
  const recipient = String(settings[CONFIG.settingsKeys.backupEmail] || '').trim();
  const sheetNames = parseBackupSheetNames_(settings[CONFIG.settingsKeys.backupSheets] || '');
  const weekdays = parseWeekdayValues_(
    settings[CONFIG.settingsKeys.backupWeekday] || '',
    CONFIG.settingsKeys.backupWeekday,
  );
  const time = String(settings[CONFIG.settingsKeys.backupTime] || '').trim();

  if (!recipient || sheetNames.length === 0 || weekdays.length === 0 || !time) {
    return {
      enabled: false,
      reason: '백업 메일 주소, 백업 대상 시트, 백업 요일, 백업 시간이 모두 입력되지 않았습니다.',
    };
  }

  const schedule = parseBackupSchedule_(weekdays, time);

  if (schedule.isDaily) {
    ScriptApp.newTrigger(CONFIG.backupTriggerHandler)
      .timeBased()
      .everyDays(1)
      .atHour(schedule.hour)
      .nearMinute(schedule.minute)
      .create();
  } else {
    schedule.weekDays.forEach((weekDay) => {
      ScriptApp.newTrigger(CONFIG.backupTriggerHandler)
        .timeBased()
        .everyWeeks(1)
        .onWeekDay(weekDay)
        .atHour(schedule.hour)
        .nearMinute(schedule.minute)
        .create();
    });
  }

  return {
    enabled: true,
    weekdays: schedule.weekdayLabel,
    time: schedule.timeLabel,
  };
}

// 설정 변경 후 이 함수를 실행하면 입력, 주문 편집, 백업 트리거를 현재 설정값 기준으로 다시 만든다.
function syncConfiguredTriggers() {
  const settings = getSettingsMap_();
  const inputTriggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.inputTriggerMinutes],
    CONFIG.triggerMinutes,
    CONFIG.settingsKeys.inputTriggerMinutes,
  );

  ensureTrigger_();
  ensureOrderEditTrigger_(getSpreadsheetByGroup_('admin'));
  ensurePickingTrigger_();
  const backupTrigger = ensureConfiguredBackupTrigger_();

  const result = {
    inputTriggerMinutes,
    backupTrigger,
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

// 백업 요일과 시간을 Apps Script 트리거 생성에 쓸 수 있는 형식으로 검증한다.
function parseBackupSchedule_(weekdays, time) {
  const parsedTime = parseBackupTimeValue_(time);
  const hour = parsedTime.hour;
  const minute = parsedTime.minute;
  const normalizedTime = parsedTime.label;

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('백업 시간 범위가 올바르지 않습니다. HH:mm 형식을 확인하세요.');
  }

  if (weekdays.includes('매일')) {
    return {
      isDaily: true,
      hour,
      minute,
      weekDays: [],
      weekdayLabel: '매일',
      timeLabel: normalizedTime,
    };
  }

  return {
    isDaily: false,
    hour,
    minute,
    weekDays: weekdays.map((weekday) => getScriptWeekDay_(weekday)),
    weekdayLabel: weekdays.join(','),
    timeLabel: normalizedTime,
  };
}

// 반복 분 트리거는 Apps Script 제한에 맞는 값만 허용한다.
function parseRecurringTriggerMinutes_(value, fallback, settingLabel) {
  const allowedValues = [1, 5, 10, 15, 30];
  const normalized = String(value || '').trim();

  if (!normalized) {
    return fallback;
  }

  const minutes = Number(normalized);

  if (!Number.isInteger(minutes) || !allowedValues.includes(minutes)) {
    throw new Error(`${settingLabel} 값은 ${allowedValues.join(', ')} 중 하나여야 합니다.`);
  }

  return minutes;
}

// 요일 설정은 매일 또는 쉼표 구분 다중 요일을 허용한다.
function parseWeekdayValues_(value, settingLabel) {
  const normalizedValues = [
    ...new Set(
      String(value || '')
        .split(/[\n,]/)
        .map((weekday) => weekday.trim())
        .filter(Boolean),
    ),
  ];

  if (normalizedValues.length === 0) {
    return [];
  }

  if (normalizedValues.includes('매일')) {
    if (normalizedValues.length > 1) {
      throw new Error(`${settingLabel} 값에 매일과 개별 요일을 함께 넣을 수 없습니다.`);
    }

    return ['매일'];
  }

  normalizedValues.forEach((weekday) => {
    getScriptWeekDay_(weekday);
  });

  return normalizedValues;
}

// 한글 요일을 Apps Script WeekDay enum으로 바꾼다.
function getScriptWeekDay_(weekday) {
  const weekDayMap = {
    월: ScriptApp.WeekDay.MONDAY,
    화: ScriptApp.WeekDay.TUESDAY,
    수: ScriptApp.WeekDay.WEDNESDAY,
    목: ScriptApp.WeekDay.THURSDAY,
    금: ScriptApp.WeekDay.FRIDAY,
    토: ScriptApp.WeekDay.SATURDAY,
    일: ScriptApp.WeekDay.SUNDAY,
  };

  if (!weekDayMap[weekday]) {
    throw new Error('요일 값은 매일 또는 월,화,수,목,금,토,일 형식이어야 합니다.');
  }

  return weekDayMap[weekday];
}

// 운영 시간 설정을 읽어 현재가 실행 가능한 시간대인지 확인한다.
function shouldRunDuringOperatingHours_() {
  const settings = getSettingsMap_();
  const weekdays = parseWeekdayValues_(
    settings[CONFIG.settingsKeys.operatingWeekdays],
    CONFIG.settingsKeys.operatingWeekdays,
  );
  const startTime = parseBackupTimeValue_(settings[CONFIG.settingsKeys.operatingStartTime]);
  const endTime = parseBackupTimeValue_(settings[CONFIG.settingsKeys.operatingEndTime]);
  const now = new Date();
  const currentWeekday = getCurrentWeekdayLabel_(now);

  if (!weekdays.includes('매일') && !weekdays.includes(currentWeekday)) {
    return false;
  }

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startTime.hour * 60 + startTime.minute;
  const endMinutes = endTime.hour * 60 + endTime.minute;

  if (startMinutes === endMinutes) {
    return true;
  }

  if (startMinutes < endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }

  return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
}

// 현재 날짜를 한글 요일 한 글자로 반환한다.
function getCurrentWeekdayLabel_(date) {
  const labels = ['일', '월', '화', '수', '목', '금', '토'];
  return labels[date.getDay()];
}

// 시간 셀은 Date 타입, HH:mm 문자열, 오전/오후 표시 문자열까지 모두 받아들인다.
function parseBackupTimeValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
    const hour = value.getHours();
    const minute = value.getMinutes();

    return {
      hour,
      minute,
      label: padTimeNumber_(hour) + ':' + padTimeNumber_(minute),
    };
  }

  const text = String(value || '').trim();
  const exactMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

  if (exactMatch) {
    const hour = Number(exactMatch[1]);
    const minute = Number(exactMatch[2]);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return {
        hour,
        minute,
        label: padTimeNumber_(hour) + ':' + padTimeNumber_(minute),
      };
    }
  }

  const meridiemMatch = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);

  if (meridiemMatch) {
    let hour = Number(meridiemMatch[1]);
    const minute = Number(meridiemMatch[2]);
    const meridiem = meridiemMatch[4].toUpperCase();

    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      if (meridiem === 'AM') {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }

      return {
        hour,
        minute,
        label: padTimeNumber_(hour) + ':' + padTimeNumber_(minute),
      };
    }
  }

  throw new Error('백업 시간 형식은 HH:mm 이어야 합니다. 예: 09:00');
}

// 시간 표시는 항상 두 자리 HH:mm으로 맞춘다.
function padTimeNumber_(value) {
  return value < 10 ? `0${value}` : String(value);
}

// 초기 설정과 권한 승인을 한 번에 끝내기 위한 진입 함수다.
function authorizeAll() {
  const setupResult = setupSystem();
  const triggerSyncResult = syncConfiguredTriggers();

  // 권한 범위에 포함되는 주요 서비스들을 한 번씩 실제 호출해 승인창을 유도한다.
  LockService.getScriptLock().tryLock(1);
  ScriptApp.getProjectTriggers();
  PropertiesService.getScriptProperties().getProperties();
  getRootFolder_().getId();
  Object.keys(CONFIG.spreadsheetFiles).forEach((group) => getSpreadsheetByGroup_(group).getId());
  getConfiguredFolder_(CONFIG.properties.inputFolderId).getId();

  const settings = getSettingsMap_();
  const hasBackupSettings =
    String(settings[CONFIG.settingsKeys.backupEmail] || '').trim() &&
    parseBackupSheetNames_(settings[CONFIG.settingsKeys.backupSheets] || '').length > 0;

  // 백업 설정이 이미 있으면 실제 메일을 한 번 보내 Gmail/UrlFetch 권한까지 같이 승인한다.
  const backupResult = hasBackupSettings ? sendConfiguredBackupEmail() : null;

  const result = {
    setupSystem: setupResult,
    triggerSync: triggerSyncResult,
    backupEmailSent: Boolean(backupResult),
    backupResult,
    message: hasBackupSettings
      ? '권한 초기화와 백업 메일 테스트를 완료했습니다.'
      : '권한 초기화를 완료했습니다. 백업 메일 주소와 대상 시트를 입력한 뒤 sendConfiguredBackupEmail()를 한 번 실행하세요.',
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}
