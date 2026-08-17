// 입력 파일 형식에 따라 CSV 텍스트 또는 스프레드시트 표 데이터를 2차원 배열로 읽는다.
function parseCsvFile_(file) {
  if (isGoogleSpreadsheetFile_(file)) {
    return readSpreadsheetTable_(file.getId());
  }

  if (isExcelFile_(file)) {
    return readExcelTable_(file);
  }

  let text = file.getBlob().getDataAsString('UTF-8');

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  return Utilities.parseCsv(text);
}

// 구글 스프레드시트 파일은 첫 번째 시트의 표시값을 그대로 읽는다.
function readSpreadsheetTable_(spreadsheetId) {
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheets()[0];

  if (!sheet) {
    return [];
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow === 0 || lastColumn === 0) {
    return [];
  }

  return sheet.getRange(1, 1, lastRow, lastColumn).getDisplayValues();
}

// 엑셀 파일은 임시로 구글 스프레드시트로 변환한 뒤 첫 번째 시트를 읽고 바로 정리한다.
function readExcelTable_(file) {
  if (typeof Drive === 'undefined' || !Drive.Files || !Drive.Files.insert) {
    throw appError_(
      'DRIVE_API_NOT_ENABLED',
      'xlsx 처리를 위해 Apps Script 고급 Drive 서비스를 활성화하세요.',
      'FILE_PARSE',
    );
  }

  const convertedFile = Drive.Files.insert(
    {
      title: `[temp] ${file.getName()}`,
      mimeType: MimeType.GOOGLE_SHEETS,
      parents: [{ id: getRootFolder_().getId() }],
    },
    file.getBlob(),
    { convert: true },
  );

  try {
    return readSpreadsheetTable_(convertedFile.id);
  } finally {
    DriveApp.getFileById(convertedFile.id).setTrashed(true);
  }
}

// 구글 스프레드시트로 업로드된 파일도 입력 대상으로 허용한다.
function isGoogleSpreadsheetFile_(file) {
  return file.getMimeType() === MimeType.GOOGLE_SHEETS;
}

// 엑셀 원본 파일은 확장자와 MIME 타입 기준으로 판별한다.
function isExcelFile_(file) {
  const name = file.getName().toLowerCase();
  const mimeType = file.getMimeType();

  return (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    mimeType === MimeType.MICROSOFT_EXCEL ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  );
}

// 헤더 비교 전에는 공백과 BOM을 제거해서 비교 기준을 통일한다.
function normalizeHeader_(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim();
}

// 헤더는 중복, 필수 누락, 미지원 컬럼 순서로 검사한다.
function validateHeaders_(headers) {
  const duplicateHeaders = findDuplicates_(headers);
  if (duplicateHeaders.length > 0) {
    throw appError_(
      'DUPLICATE_HEADER',
      `중복 헤더: ${duplicateHeaders.join(', ')}`,
      'HEADER_VALIDATION',
    );
  }

  const missing = REQUIRED_HEADERS.filter((header) => !headers.includes(header));
  if (missing.length > 0) {
    throw appError_('MISSING_HEADER', `필수 헤더 누락: ${missing.join(', ')}`, 'HEADER_VALIDATION');
  }

  const unknown = headers.filter(
    (header) =>
      header &&
      !PRODUCT_HEADERS.includes(header) &&
      !PRODUCT_IGNORED_IMPORT_HEADERS.includes(header),
  );
  if (unknown.length > 0) {
    throw appError_(
      'UNKNOWN_HEADER',
      `지원하지 않는 헤더: ${unknown.join(', ')}`,
      'HEADER_VALIDATION',
    );
  }
}

// 한 줄씩 객체로 바꿔두면 이후 검증과 적재 단계에서 헤더명으로 접근할 수 있다.
function mapRowsToObjects_(headers, rows) {
  return rows.map((row, index) => {
    const result = { __rowNumber: index + 2 };

    headers.forEach((header, columnIndex) => {
      result[header] = String(row[columnIndex] ?? '').trim();
    });

    return result;
  });
}

// 상품 행은 필수값, 파일 내부 중복, 숫자 형식, 날짜 형식을 모두 확인한다.
function validateProductRows_(rows) {
  const errors = [];
  const seenCodes = new Set();

  rows.forEach((row) => {
    const rowNumber = row.__rowNumber;
    const productCode = row['상품품목코드'];

    if (!productCode) {
      errors.push({
        rowNumber,
        productCode: '',
        code: 'REQUIRED_VALUE',
        message: '상품품목코드는 필수입니다.',
      });
    } else if (seenCodes.has(productCode)) {
      errors.push({
        rowNumber,
        productCode,
        code: 'DUPLICATE_IN_FILE',
        message: 'CSV 내부 상품품목코드가 중복되었습니다.',
      });
    } else {
      seenCodes.add(productCode);
    }

    if (!row['상품명']) {
      errors.push({
        rowNumber,
        productCode,
        code: 'REQUIRED_VALUE',
        message: '상품명은 필수입니다.',
      });
    }

    NUMERIC_HEADERS.forEach((header) => {
      const value = row[header];

      if (value === '') {
        return;
      }

      const number = Number(value.replace(/,/g, ''));

      if (!Number.isFinite(number) || number < 0) {
        errors.push({
          rowNumber,
          productCode,
          code: 'INVALID_NUMBER',
          message: `${header}은 0 이상의 숫자여야 합니다: ${value}`,
        });
      }
    });

    if (row['유효기간'] && !isDateText_(row['유효기간'])) {
      errors.push({
        rowNumber,
        productCode,
        code: 'INVALID_DATE',
        message: `유효기간 형식은 YYYY-MM-DD 또는 YYYY/MM/DD여야 합니다.`,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 유효기간은 단순 포맷만 먼저 검증하고 실제 Date 변환은 저장 직전에 한다.
function isDateText_(value) {
  const text = String(value || '').trim();
  return /^\d{4}[-/]\d{2}[-/]\d{2}$/.test(text);
}

// 중복 헤더 탐지에 재사용하는 범용 유틸 함수다.
function findDuplicates_(values) {
  const seen = new Set();
  const duplicates = new Set();

  values.forEach((value) => {
    if (!value) return;
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  });

  return [...duplicates];
}
