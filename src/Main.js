// 공통 input 폴더를 순회하면서 헤더 구조에 따라 상품/주문 처리 흐름으로 자동 분기한다.
function scanInputFolder() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log('다른 입력 파일 작업이 실행 중입니다.');
    return;
  }

  try {
    if (!shouldRunDuringOperatingHours_()) {
      console.log('운영 시간이 아니므로 입력 폴더 스캔을 건너뜁니다.');
      return;
    }

    const folder = getConfiguredFolder_(CONFIG.properties.inputFolderId);
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      if (!isSupportedImportFile_(file)) {
        continue;
      }

      routeInputFile_(file);
    }
  } finally {
    lock.releaseLock();
  }
}

// 파일을 한 번만 읽고 필수 헤더 조합으로 상품 파일인지 주문 파일인지 판별한다.
function routeInputFile_(file) {
  const startedAt = new Date();

  try {
    const table = parseCsvFile_(file);
    const nonEmptyRows = table.filter((row) =>
      row.some((value) => String(value ?? '').trim() !== ''),
    );
    const headers = nonEmptyRows.length > 0 ? nonEmptyRows[0].map(normalizeHeader_) : [];
    const inputType = detectInputTypeFromHeaders_(headers);

    if (inputType === 'order') {
      return processOrderFile(file, nonEmptyRows);
    }

    return processCsvFile_(file, nonEmptyRows);
  } catch (error) {
    appendErrorLog_(file, error.stage || 'INPUT_ROUTING', {
      rowNumber: '',
      productCode: '',
      code: error.code || 'INPUT_TYPE_DETECTION_FAILED',
      message: error.message || String(error),
    });
    appendHistory_(file, {
      status: 'FAILED',
      totalRows: 0,
      importedRows: 0,
      errorCount: 1,
      startedAt,
      message: error.message || String(error),
    });
    moveFileToErrorFolder_(file);
    console.error(`입력 파일 유형 판별 실패: ${file.getName()}`, error);
    return null;
  }
}

// 주문/상품 고유 필수 헤더가 모두 있는지 비교해 입력 종류를 결정한다.
function detectInputTypeFromHeaders_(headers) {
  const normalizedHeaders = (headers || []).map(normalizeHeader_).filter(Boolean);
  const normalizedOrderHeaders = normalizedHeaders.map(normalizeOrderImportHeader_);
  const normalizedProductHeaders = normalizedHeaders.map(normalizeProductImportHeader_);
  const hasOrderHeaders = REQUIRED_ORDER_HEADERS.every((header) =>
    normalizedOrderHeaders.includes(header),
  );
  const hasProductHeaders = REQUIRED_HEADERS.every((header) =>
    normalizedProductHeaders.includes(header),
  );

  if (hasOrderHeaders && hasProductHeaders) {
    throw appError_(
      'AMBIGUOUS_INPUT_TYPE',
      '주문과 상품 필수 헤더가 동시에 있어 파일 유형을 판별할 수 없습니다.',
      'INPUT_ROUTING',
    );
  }

  if (hasOrderHeaders) {
    return 'order';
  }

  if (hasProductHeaders) {
    return 'product';
  }

  const missingOrderHeaders = REQUIRED_ORDER_HEADERS.filter(
    (header) => !normalizedOrderHeaders.includes(header),
  );
  const missingProductHeaders = REQUIRED_HEADERS.filter(
    (header) => !normalizedProductHeaders.includes(header),
  );

  throw appError_(
    'UNKNOWN_INPUT_TYPE',
    `주문 또는 상품 파일로 판별할 수 없습니다. 주문 필수 헤더 누락: ${missingOrderHeaders.join(', ')} / 상품 필수 헤더 누락: ${missingProductHeaders.join(', ')}`,
    'INPUT_ROUTING',
  );
}

// 상품 CSV 한 개를 파싱, 검증, 저장, 기록, 입력 파일 정리까지 처리하는 메인 흐름이다.
function processCsvFile_(file, parsedTable) {
  const startedAt = new Date();
  let totalRows = 0;
  let importedRows = 0;

  try {
    assertFileNotProcessed_(file);

    const table = parsedTable || parseCsvFile_(file);

    if (table.length < 2) {
      throw appError_('EMPTY_CSV', 'CSV에 데이터 행이 없습니다.', 'CSV_PARSE');
    }

    const headers = table[0].map(normalizeProductImportHeader_);
    validateHeaders_(headers);

    // 헤더 아래의 실제 데이터 행만 추려서 빈 줄은 버린다.
    const rows = table
      .slice(1)
      .filter((row) => row.some((value) => String(value || '').trim() !== ''));

    totalRows = rows.length;

    const products = mapRowsToObjects_(headers, rows);
    const validation = validateProductRows_(products);

    // 행 검증 오류는 개별 오류 로그를 남긴 뒤 파일 전체 실패로 처리한다.
    if (!validation.valid) {
      validation.errors.forEach((error) => {
        appendErrorLog_(file, 'ROW_VALIDATION', error);
      });

      const error = appError_(
        'ROW_VALIDATION_FAILED',
        `행 검증 실패: ${validation.errors.length}건`,
        'ROW_VALIDATION',
      );
      error.alreadyLogged = true;
      throw error;
    }

    // 실제 저장 단계에서 기존 상품은 누적 갱신하고, 없는 상품만 신규 추가한다.
    importedRows = importProducts_(file, products);

    appendHistory_(file, {
      status: 'SUCCESS',
      totalRows,
      importedRows,
      errorCount: 0,
      startedAt,
      message: '상품마스터 등록 완료',
    });
    moveFileToSuccessFolder_(file);
    refreshOperationsDashboardsSafely_();
  } catch (error) {
    // 예외가 아직 로그로 남지 않은 경우에만 공통 오류 로그를 한 번 추가한다.
    if (!error.alreadyLogged) {
      appendErrorLog_(file, error.stage || 'PROCESS', {
        rowNumber: '',
        productCode: '',
        code: error.code || 'UNEXPECTED_ERROR',
        message: error.message || String(error),
      });
    }

    appendHistory_(file, {
      status: 'FAILED',
      totalRows,
      importedRows,
      errorCount: 1,
      startedAt,
      message: error.message || String(error),
    });
    moveFileToErrorFolder_(file);

    console.error(`파일 처리 실패: ${file.getName()}`, error);
  }
}

// CSV 텍스트, 엑셀 파일, 구글 스프레드시트만 처리 대상으로 본다.
function isSupportedImportFile_(file) {
  return (
    isGoogleSpreadsheetFile_(file) ||
    isExcelFile_(file) ||
    file.getName().toLowerCase().endsWith('.csv') ||
    file.getMimeType() === MimeType.CSV ||
    file.getMimeType() === 'text/csv'
  );
}

// 폴더 ID는 Script Properties에 저장된 값을 기준으로 찾는다.
function getConfiguredFolder_(propertyKey) {
  const id = PropertiesService.getScriptProperties().getProperty(propertyKey);

  if (!id) {
    throw new Error('setupSystem()을 먼저 실행하세요.');
  }

  return DriveApp.getFolderById(id);
}
