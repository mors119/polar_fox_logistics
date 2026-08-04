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
    ensureConfiguredBackupTrigger_();

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
  applySettingsSheetFormats_(sheet);
  return sheet;
}

// 설정 시트의 입력 셀은 용도에 맞는 표시 형식으로 맞춰 사용자가 헷갈리지 않게 한다.
function applySettingsSheetFormats_(sheet) {
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return;
  }

  const labels = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();

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
  const settings = getSettingsMap_();
  const triggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.productTriggerMinutes],
    CONFIG.triggerMinutes,
    CONFIG.settingsKeys.productTriggerMinutes,
  );

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === CONFIG.triggerHandler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(CONFIG.triggerHandler)
    .timeBased()
    .everyMinutes(triggerMinutes)
    .create();
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

// 설정 변경 후 이 함수를 실행하면 상품, 주문, 백업 트리거를 현재 설정값 기준으로 다시 만든다.
function syncConfiguredTriggers() {
  const settings = getSettingsMap_();
  const importTriggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.productTriggerMinutes],
    CONFIG.triggerMinutes,
    CONFIG.settingsKeys.productTriggerMinutes,
  );
  const orderTriggerMinutes = parseRecurringTriggerMinutes_(
    settings[CONFIG.settingsKeys.orderTriggerMinutes],
    ORDER_CONFIG.triggerMinutes,
    CONFIG.settingsKeys.orderTriggerMinutes,
  );

  ensureTrigger_();
  ensureOrderTrigger_();
  const backupTrigger = ensureConfiguredBackupTrigger_();

  const result = {
    importTriggerMinutes,
    orderTriggerMinutes,
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
    throw new Error(
      `${settingLabel} 값은 ${allowedValues.join(', ')} 중 하나여야 합니다.`,
    );
  }

  return minutes;
}

// 요일 설정은 매일 또는 쉼표 구분 다중 요일을 허용한다.
function parseWeekdayValues_(value, settingLabel) {
  const normalizedValues = [...new Set(
    String(value || '')
      .split(/[\n,]/)
      .map((weekday) => weekday.trim())
      .filter(Boolean),
  )];

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
  const orderSetupResult = setupOrderCsvSystem();
  const triggerSyncResult = syncConfiguredTriggers();

  // 권한 범위에 포함되는 주요 서비스들을 한 번씩 실제 호출해 승인창을 유도한다.
  LockService.getScriptLock().tryLock(1);
  ScriptApp.getProjectTriggers();
  PropertiesService.getScriptProperties().getProperties();
  getRootFolder_().getId();
  getSpreadsheet_().getId();
  getConfiguredFolder_(CONFIG.properties.inputFolderId).getId();
  getConfiguredFolder_(ORDER_CONFIG.properties.inputFolderId).getId();

  const settings = getSettingsMap_();
  const hasBackupSettings =
    String(settings[CONFIG.settingsKeys.backupEmail] || '').trim() &&
    parseBackupSheetNames_(settings[CONFIG.settingsKeys.backupSheets] || '').length > 0;

  // 백업 설정이 이미 있으면 실제 메일을 한 번 보내 Gmail/UrlFetch 권한까지 같이 승인한다.
  const backupResult = hasBackupSettings ? sendConfiguredBackupEmail() : null;

  const result = {
    setupSystem: setupResult,
    setupOrderCsvSystem: orderSetupResult,
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
