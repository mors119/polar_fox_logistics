function scanCsvInputFolder() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    console.log("다른 CSV 작업이 실행 중입니다.");
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

function processCsvFile_(file) {
  const startedAt = new Date();
  let totalRows = 0;
  let importedRows = 0;

  try {
    assertFileNotProcessed_(file);

    const table = parseCsvFile_(file);

    if (table.length < 2) {
      throw appError_("EMPTY_CSV", "CSV에 데이터 행이 없습니다.", "CSV_PARSE");
    }

    const headers = table[0].map(normalizeHeader_);
    validateHeaders_(headers);

    const rows = table
      .slice(1)
      .filter(row => row.some(value => String(value || "").trim() !== ""));

    totalRows = rows.length;

    const products = mapRowsToObjects_(headers, rows);
    const validation = validateProductRows_(products);

    if (!validation.valid) {
      validation.errors.forEach(error => {
        appendErrorLog_(file, "ROW_VALIDATION", error);
      });

      const error = appError_(
        "ROW_VALIDATION_FAILED",
        `행 검증 실패: ${validation.errors.length}건`,
        "ROW_VALIDATION"
      );
      error.alreadyLogged = true;
      throw error;
    }

    assertNoDuplicateProductCodes_(products);
    importedRows = importProducts_(file, products);

    moveFile_(file, CONFIG.properties.processedFolderId);

    appendHistory_(file, {
      status: "SUCCESS",
      totalRows,
      importedRows,
      errorCount: 0,
      startedAt,
      message: "상품마스터 등록 완료"
    });
  } catch (error) {
    if (!error.alreadyLogged) {
      appendErrorLog_(file, error.stage || "PROCESS", {
        rowNumber: "",
        productCode: "",
        code: error.code || "UNEXPECTED_ERROR",
        message: error.message || String(error)
      });
    }

    try {
      moveFile_(file, CONFIG.properties.errorFolderId);
    } catch (moveError) {
      console.error("오류 파일 이동 실패", moveError);
    }

    appendHistory_(file, {
      status: "FAILED",
      totalRows,
      importedRows,
      errorCount: 1,
      startedAt,
      message: error.message || String(error)
    });

    console.error(`파일 처리 실패: ${file.getName()}`, error);
  }
}

function isCsvFile_(file) {
  return file.getName().toLowerCase().endsWith(".csv") ||
    file.getMimeType() === MimeType.CSV ||
    file.getMimeType() === "text/csv";
}

function getConfiguredFolder_(propertyKey) {
  const id = PropertiesService
    .getScriptProperties()
    .getProperty(propertyKey);

  if (!id) {
    throw new Error("setupSystem()을 먼저 실행하세요.");
  }

  return DriveApp.getFolderById(id);
}
