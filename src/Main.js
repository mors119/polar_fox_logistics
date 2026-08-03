// 상품 입력 폴더를 순회하면서 CSV 파일만 골라 처리한다.
function scanCsvInputFolder() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log('다른 CSV 작업이 실행 중입니다.');
    return;
  }

  try {
    const folder = getConfiguredFolder_(CONFIG.properties.inputFolderId);
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();

      if (!isCsvFile_(file)) {
        continue;
      }

      processCsvFile_(file);
    }
  } finally {
    lock.releaseLock();
  }
}

// 상품 CSV 한 개를 파싱, 검증, 저장, 기록, 입력 파일 정리까지 처리하는 메인 흐름이다.
function processCsvFile_(file) {
  const startedAt = new Date();
  let totalRows = 0;
  let importedRows = 0;

  try {
    assertFileNotProcessed_(file);

    const table = parseCsvFile_(file);

    if (table.length < 2) {
      throw appError_('EMPTY_CSV', 'CSV에 데이터 행이 없습니다.', 'CSV_PARSE');
    }

    const headers = table[0].map(normalizeHeader_);
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

    // 시트 중복 검사와 실제 저장은 검증이 끝난 뒤에만 수행한다.
    assertNoDuplicateProductCodes_(products);
    importedRows = importProducts_(file, products);

    appendHistory_(file, {
      status: 'SUCCESS',
      totalRows,
      importedRows,
      errorCount: 0,
      startedAt,
      message: '상품마스터 등록 완료',
    });
    trashFile_(file);
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
    trashFile_(file);

    console.error(`파일 처리 실패: ${file.getName()}`, error);
  }
}

// 확장자와 MIME 타입 기준으로 CSV 파일만 처리 대상으로 본다.
function isCsvFile_(file) {
  return (
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
