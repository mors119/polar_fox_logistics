// 설정 시트의 값을 읽어 선택된 시트만 백업 파일로 묶어 메일로 발송한다.
function sendConfiguredBackupEmail() {
  const settings = getSettingsMap_();
  const recipient = String(settings[CONFIG.settingsKeys.backupEmail] || '').trim();
  const requestedSheetNames = parseBackupSheetNames_(
    settings[CONFIG.settingsKeys.backupSheets] || '',
  );

  if (!recipient) {
    throw new Error('설정 시트에 백업 메일 주소를 입력하세요.');
  }

  if (requestedSheetNames.length === 0) {
    throw new Error('설정 시트에 백업 대상 시트를 입력하세요.');
  }

  const spreadsheet = getSpreadsheet_();
  const sheets = getBackupSheets_(spreadsheet, requestedSheetNames);
  const backupFile = createBackupSpreadsheetFile_(spreadsheet, sheets);
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyy-MM-dd HH:mm:ss',
  );

  try {
    const attachment = exportSpreadsheetAsExcel_(backupFile.getId(), timestamp);

    GmailApp.sendEmail(
      recipient,
      `[polar_fox_logistics] 시트 백업 ${timestamp}`,
      [
        'polar_fox_logistics 시트 백업 파일입니다.',
        '',
        `백업 시각: ${timestamp}`,
        `백업 대상 시트: ${sheets.map((sheet) => sheet.getName()).join(', ')}`,
      ].join('\n'),
      {
        attachments: [attachment],
      },
    );
  } finally {
    backupFile.setTrashed(true);
  }

  const result = {
    recipient,
    sheetNames: sheets.map((sheet) => sheet.getName()),
    sentAt: timestamp,
  };

  console.log(JSON.stringify(result, null, 2));
  return result;
}

// 설정 시트는 항목명을 키로 읽어 이후 기능에서 공통으로 재사용한다.
function getSettingsMap_() {
  const sheet = getSheet_(CONFIG.sheets.settings);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {};
  }

  return sheet
    .getRange(2, 1, lastRow - 1, 2)
    .getDisplayValues()
    .reduce((result, row) => {
      const key = String(row[0] || '').trim();

      if (key) {
        result[key] = String(row[1] || '').trim();
      }

      return result;
    }, {});
}

// 백업 대상 시트는 쉼표 또는 줄바꿈 구분으로 입력받는다.
function parseBackupSheetNames_(value) {
  return [...new Set(
    String(value || '')
      .split(/[\n,]/)
      .map((name) => name.trim())
      .filter(Boolean),
  )];
}

// 설정값으로 지정된 시트명이 실제 운영 스프레드시트에 모두 존재하는지 확인한다.
function getBackupSheets_(spreadsheet, requestedSheetNames) {
  const sheets = requestedSheetNames.map((sheetName) => {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      throw new Error(`백업 대상 시트를 찾을 수 없습니다: ${sheetName}`);
    }

    return sheet;
  });

  if (sheets.length === 0) {
    throw new Error('백업 대상 시트를 하나 이상 선택하세요.');
  }

  return sheets;
}

// 선택된 시트만 포함한 임시 스프레드시트를 만든 뒤 메일 첨부용 파일로 반환한다.
function createBackupSpreadsheetFile_(sourceSpreadsheet, sheets) {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd_HHmmss',
  );
  const tempSpreadsheet = SpreadsheetApp.create(`${sourceSpreadsheet.getName()}_backup_${timestamp}`);
  const tempFile = DriveApp.getFileById(tempSpreadsheet.getId());
  const defaultSheet = tempSpreadsheet.getSheets()[0];

  moveFileToRootFolder_(tempFile);

  sheets.forEach((sheet) => {
    const copiedSheet = sheet.copyTo(tempSpreadsheet);
    copiedSheet.setName(sheet.getName());
  });

  if (tempSpreadsheet.getSheets().length > 1) {
    tempSpreadsheet.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.flush();

  return tempFile;
}

// 구글 스프레드시트 파일은 Drive export로 xlsx 첨부파일 블롭을 만든다.
function exportSpreadsheetAsExcel_(fileId, timestamp) {
  const response = UrlFetchApp.fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(CONFIG.backupExportMimeType)}`,
    {
      headers: {
        Authorization: `Bearer ${ScriptApp.getOAuthToken()}`,
      },
      muteHttpExceptions: true,
    },
  );

  if (response.getResponseCode() !== 200) {
    throw new Error(`xlsx 백업 export 실패: ${response.getContentText()}`);
  }

  return response.getBlob().setName(`polar_fox_backup_${timestamp}.xlsx`);
}
