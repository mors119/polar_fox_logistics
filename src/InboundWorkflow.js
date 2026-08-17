const INBOUND_STATUS = Object.freeze({
  productValidated: '검증완료',
  productCreated: '상품등록완료',
  existingProduct: '기존상품확인',
  waiting: '입고정보입력대기',
  validated: '입고검수완료',
  processing: '입고확정처리중',
  completed: '입고완료',
  error: '입고확정오류',
  recoveryRequired: '자동복구확인필요',
});

const INBOUND_RECOVERY_PREFIX = 'RECOVERY:';

// 스프레드시트에서 주요 상품·입고 기능을 바로 실행할 수 있게 메뉴를 제공한다.
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('재고관리')
    .addItem('상품 검증', 'validateNewProduct')
    .addItem('상품 승인', 'approveNewProduct')
    .addSeparator()
    .addItem('입고 검수', 'validateInbound')
    .addItem('입고 확정', 'confirmInbound')
    .addSeparator()
    .addItem('피킹지시 생성', 'createPickingInstruction')
    .addItem('피킹결과 반영', 'syncPickingResults')
    .addItem('피킹 대시보드 갱신', 'refreshPickingDashboard')
    .addToUi();
}

// 상품등록의 필수값·수량·날짜·탭 내 중복을 검사한다.
function validateNewProduct() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_(CONFIG.sheets.productRegistration);
    const records = getWorkflowRecords_(sheet);
    const finalStatuses = [INBOUND_STATUS.productCreated, INBOUND_STATUS.existingProduct];
    const activeRecords = records.filter(
      (item) => !finalStatuses.includes(normalizeWorkflowText_(item.record['처리상태'])),
    );
    const codeCounts = countWorkflowValues_(activeRecords, '상품품목코드');
    let validatedCount = 0;
    let errorCount = 0;

    records.forEach((item) => {
      if (finalStatuses.includes(normalizeWorkflowText_(item.record['처리상태']))) {
        return;
      }

      if (isWorkflowRecordEmpty_(item.record, PRODUCT_REGISTRATION_INPUT_HEADERS)) {
        return;
      }

      const code = normalizeWorkflowText_(item.record['상품품목코드']);
      const errors = validateProductRegistrationRecord_(item.record);

      if (code && codeCounts[code] > 1) {
        errors.push('상품등록 탭 내 상품품목코드가 중복되었습니다.');
      }

      setWorkflowResult_(
        sheet,
        item.rowNumber,
        errors.length ? '오류' : INBOUND_STATUS.productValidated,
        errors,
      );
      if (errors.length) errorCount += 1;
      else validatedCount += 1;
    });

    return { validatedCount, errorCount };
  } finally {
    lock.releaseLock();
  }
}

// 검증된 상품만 0재고 마스터와 신규/재입고 대기작업으로 전환한다.
function approveNewProduct() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const registrationSheet = getSheet_(CONFIG.sheets.productRegistration);
    const pendingSheet = getSheet_(CONFIG.sheets.inboundPending);
    const productSheet = getSheet_(CONFIG.sheets.products);
    const registrationHeaderMap = getHeaderIndexMap_(registrationSheet);
    let productMap = getExistingProductMap_(productSheet);
    let approvedCount = 0;
    let errorCount = 0;

    getWorkflowRecords_(registrationSheet).forEach((item) => {
      const status = normalizeWorkflowText_(item.record['처리상태']);
      if (status !== INBOUND_STATUS.productValidated) {
        return;
      }

      const errors = validateProductRegistrationRecord_(item.record);
      if (errors.length) {
        setWorkflowResult_(registrationSheet, item.rowNumber, '오류', errors);
        errorCount += 1;
        return;
      }

      try {
        let registrationId = normalizeWorkflowText_(item.record['등록작업ID']);
        if (!registrationId) {
          registrationId = createWorkflowId_('REGTASK');
          setSheetCellByHeader_(
            registrationSheet,
            item.rowNumber,
            registrationHeaderMap,
            '등록작업ID',
            registrationId,
          );
        }

        const productCode = normalizeWorkflowText_(item.record['상품품목코드']);
        const existingProduct = productMap[productCode];
        const createdByThisRegistration =
          existingProduct &&
          normalizeWorkflowText_(existingProduct.record['원본파일ID']) === registrationId;
        const wasExisting = Boolean(existingProduct) && !createdByThisRegistration;

        if (!existingProduct) {
          appendInitialProduct_(productSheet, item.record, registrationId);
          productMap = getExistingProductMap_(productSheet);
        }

        if (!findInboundByRegistrationId_(registrationId)) {
          appendInboundTask_(pendingSheet, item.record, registrationId, wasExisting);
        }

        setWorkflowResult_(
          registrationSheet,
          item.rowNumber,
          wasExisting ? INBOUND_STATUS.existingProduct : INBOUND_STATUS.productCreated,
          [],
        );
        approvedCount += 1;
      } catch (error) {
        setWorkflowResult_(registrationSheet, item.rowNumber, '오류', [
          error.message || String(error),
        ]);
        errorCount += 1;
      }
    });

    return { approvedCount, errorCount };
  } finally {
    lock.releaseLock();
  }
}

// 입고대기에서 입력이 완성된 행만 검수하고 부족·초과를 자동 계산한다.
function validateInbound() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const sheet = getSheet_(CONFIG.sheets.inboundPending);
    const headerMap = getHeaderIndexMap_(sheet);
    let validatedCount = 0;
    let waitingCount = 0;
    let errorCount = 0;

    getWorkflowRecords_(sheet).forEach((item) => {
      if (!normalizeWorkflowText_(item.record['입고작업ID'])) {
        return;
      }

      if (normalizeWorkflowText_(item.record['처리상태']) === INBOUND_STATUS.processing) {
        return;
      }

      const result = validateInboundRecord_(item.record);
      if (result.waiting) {
        setWorkflowResult_(sheet, item.rowNumber, INBOUND_STATUS.waiting, []);
        setSheetCellByHeader_(sheet, item.rowNumber, headerMap, '부족수량', '');
        setSheetCellByHeader_(sheet, item.rowNumber, headerMap, '초과수량', '');
        waitingCount += 1;
        return;
      }

      if (result.errors.length) {
        setWorkflowResult_(sheet, item.rowNumber, '오류', result.errors);
        errorCount += 1;
        return;
      }

      setSheetCellByHeader_(sheet, item.rowNumber, headerMap, '부족수량', result.shortage);
      setSheetCellByHeader_(sheet, item.rowNumber, headerMap, '초과수량', result.overage);
      setWorkflowResult_(sheet, item.rowNumber, INBOUND_STATUS.validated, []);
      validatedCount += 1;
    });

    return { validatedCount, waitingCount, errorCount };
  } finally {
    lock.releaseLock();
  }
}

// 검수된 정상·불량 수량을 반영하고, 중단된 작업은 재실행 시 중복 반영 없이 복구한다.
function confirmInbound() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const pendingSheet = getSheet_(CONFIG.sheets.inboundPending);
    let completedCount = 0;
    let recoveredCount = 0;
    let errorCount = 0;
    const records = getWorkflowRecords_(pendingSheet).reverse();
    let shouldStop = false;

    records.forEach((item) => {
      if (shouldStop) {
        return;
      }

      const taskId = normalizeWorkflowText_(item.record['입고작업ID']);
      const status = normalizeWorkflowText_(item.record['처리상태']);
      if (!taskId || ![INBOUND_STATUS.validated, INBOUND_STATUS.processing].includes(status)) {
        return;
      }

      try {
        if (isInboundTaskCompleted_(taskId)) {
          pendingSheet.deleteRow(item.rowNumber);
          recoveredCount += 1;
          return;
        }

        const outcome =
          status === INBOUND_STATUS.processing
            ? recoverInboundTask_(pendingSheet, item)
            : confirmNewInboundTask_(pendingSheet, item);

        if (outcome === 'completed') completedCount += 1;
        else if (outcome === 'recovered') recoveredCount += 1;
        else errorCount += 1;
      } catch (error) {
        const headerMap = getHeaderIndexMap_(pendingSheet);
        setSheetCellByHeader_(
          pendingSheet,
          item.rowNumber,
          headerMap,
          '오류사유',
          `확정 중 중단: ${error.message || String(error)} / confirmInbound를 재실행하세요.`,
        );
        errorCount += 1;
        shouldStop = true;
      }
    });

    return { completedCount, recoveredCount, errorCount };
  } finally {
    lock.releaseLock();
  }
}

function validateProductRegistrationRecord_(record) {
  const errors = [];
  if (!normalizeWorkflowText_(record['상품품목코드'])) errors.push('상품품목코드는 필수입니다.');
  if (!normalizeWorkflowText_(record['상품명'])) errors.push('상품명은 필수입니다.');

  ['안전재고', '적정재고', '박스수량'].forEach((header) => {
    if (
      !isBlankWorkflowValue_(record[header]) &&
      parseNonNegativeInteger_(record[header]) === null
    ) {
      errors.push(`${header}은 0 이상의 정수여야 합니다.`);
    }
  });

  if (!isBlankWorkflowValue_(record['유효기간']) && !isValidWorkflowDate_(record['유효기간'])) {
    errors.push('유효기간은 올바른 날짜여야 합니다.');
  }
  return errors;
}

function validateInboundRecord_(record) {
  const inputHeaders = ['실제입고일', '입고예정수량', '실제입고수량', '정상수량', '불량수량'];
  const filledCount = inputHeaders.filter(
    (header) => !isBlankWorkflowValue_(record[header]),
  ).length;
  if (filledCount === 0) return { waiting: true, errors: [], shortage: '', overage: '' };

  const errors = [];
  if (filledCount !== inputHeaders.length)
    errors.push('실제입고일과 입고 수량 항목을 모두 입력하세요.');
  if (!isBlankWorkflowValue_(record['실제입고일']) && !isValidWorkflowDate_(record['실제입고일'])) {
    errors.push('실제입고일은 올바른 날짜여야 합니다.');
  }

  const quantities = {};
  inputHeaders.slice(1).forEach((header) => {
    quantities[header] = parseNonNegativeInteger_(record[header]);
    if (!isBlankWorkflowValue_(record[header]) && quantities[header] === null) {
      errors.push(`${header}은 0 이상의 정수여야 합니다.`);
    }
  });

  const expected = quantities['입고예정수량'];
  const actual = quantities['실제입고수량'];
  const normal = quantities['정상수량'];
  const defective = quantities['불량수량'];
  if (
    [actual, normal, defective].every((value) => value !== null) &&
    actual !== normal + defective
  ) {
    errors.push('실제입고수량은 정상수량 + 불량수량과 같아야 합니다.');
  }

  return {
    waiting: false,
    errors,
    shortage: expected !== null && actual !== null ? Math.max(expected - actual, 0) : '',
    overage: expected !== null && actual !== null ? Math.max(actual - expected, 0) : '',
  };
}

function appendInitialProduct_(sheet, record, registrationId) {
  const now = new Date();
  const product = {};
  PRODUCT_HEADERS.forEach((header) => {
    product[header] = PRODUCT_REGISTRATION_INPUT_HEADERS.includes(header) ? record[header] : '';
  });
  product['가용재고'] = 0;
  product['발송대기'] = 0;
  product['불량재고'] = 0;
  product['출고후잔량'] = 0;

  const values = PRODUCT_HEADERS.map((header) => convertNewProductValue_(header, product[header]));
  sheet.appendRow([
    ...values,
    registrationId,
    '수동 상품등록',
    now,
    calculateInventoryStatus_(0, 0, getNumericProductValue_(record['안전재고'])),
  ]);
}

function appendInboundTask_(sheet, product, registrationId, wasExisting) {
  const row = {
    입고작업ID: createWorkflowId_('INB'),
    등록작업ID: registrationId,
    입고구분: wasExisting ? '재입고' : '신규상품',
    처리상태: INBOUND_STATUS.waiting,
  };
  INBOUND_WORK_HEADERS.forEach((header) => {
    if (row[header] === undefined && product[header] !== undefined) row[header] = product[header];
  });
  sheet.appendRow(INBOUND_WORK_HEADERS.map((header) => row[header] ?? ''));
}

function confirmNewInboundTask_(pendingSheet, item) {
  const finalValidation = validateInboundRecord_(item.record);
  if (finalValidation.waiting || finalValidation.errors.length) {
    moveInboundToError_(
      pendingSheet,
      item.rowNumber,
      INBOUND_STATUS.error,
      finalValidation.errors.join(' / ') || '입고 확정 전에 필수 입고정보가 삭제되었습니다.',
    );
    return 'error';
  }

  const snapshot = getInboundStockSnapshot_(item.record);
  const recovery = {
    taskId: normalizeWorkflowText_(item.record['입고작업ID']),
    productCode: snapshot.productCode,
    availableBefore: snapshot.availableBefore,
    defectiveBefore: snapshot.defectiveBefore,
    availableAfter: snapshot.availableBefore + parseNonNegativeInteger_(item.record['정상수량']),
    defectiveAfter: snapshot.defectiveBefore + parseNonNegativeInteger_(item.record['불량수량']),
  };
  const headerMap = getHeaderIndexMap_(pendingSheet);
  setSheetCellByHeader_(
    pendingSheet,
    item.rowNumber,
    headerMap,
    '처리상태',
    INBOUND_STATUS.processing,
  );
  setSheetCellByHeader_(
    pendingSheet,
    item.rowNumber,
    headerMap,
    '비고',
    INBOUND_RECOVERY_PREFIX + JSON.stringify(recovery),
  );
  setWorkflowExecution_(pendingSheet, item.rowNumber, headerMap);
  SpreadsheetApp.flush();

  applyInboundStock_(snapshot, recovery.availableAfter, recovery.defectiveAfter);
  finishInboundTask_(pendingSheet, item.rowNumber, item.record, recovery);
  return 'completed';
}

function recoverInboundTask_(pendingSheet, item) {
  const note = normalizeWorkflowText_(item.record['비고']);
  let recovery;
  try {
    recovery = JSON.parse(note.slice(INBOUND_RECOVERY_PREFIX.length));
  } catch (error) {
    moveInboundToError_(
      pendingSheet,
      item.rowNumber,
      INBOUND_STATUS.recoveryRequired,
      '복구 정보를 읽을 수 없습니다.',
    );
    return 'error';
  }

  const snapshot = getInboundStockSnapshot_(item.record);
  const recoveryState = classifyInboundRecovery_(snapshot, recovery);

  if (recoveryState === 'ambiguous') {
    moveInboundToError_(
      pendingSheet,
      item.rowNumber,
      INBOUND_STATUS.recoveryRequired,
      `현재 재고(${snapshot.availableBefore}/${snapshot.defectiveBefore})가 복구 기준과 다릅니다.`,
    );
    return 'error';
  }

  if (recoveryState === 'before') {
    applyInboundStock_(snapshot, Number(recovery.availableAfter), Number(recovery.defectiveAfter));
  }
  finishInboundTask_(pendingSheet, item.rowNumber, item.record, recovery);
  return 'recovered';
}

function classifyInboundRecovery_(snapshot, recovery) {
  const isBefore =
    Number(snapshot.availableBefore) === Number(recovery.availableBefore) &&
    Number(snapshot.defectiveBefore) === Number(recovery.defectiveBefore);
  const isAfter =
    Number(snapshot.availableBefore) === Number(recovery.availableAfter) &&
    Number(snapshot.defectiveBefore) === Number(recovery.defectiveAfter);

  if (isAfter) return 'after';
  if (isBefore) return 'before';
  return 'ambiguous';
}

function getInboundStockSnapshot_(record) {
  const productCode = normalizeWorkflowText_(record['상품품목코드']);
  const sheet = getSheet_(CONFIG.sheets.products);
  const product = getExistingProductMap_(sheet)[productCode];
  if (!product) throw new Error(`상품마스터에 없는 상품품목코드입니다: ${productCode}`);

  const headerMap = getHeaderIndexMap_(sheet);
  return {
    sheet,
    headerMap,
    rowNumber: product.rowNumber,
    productCode,
    availableBefore: Number(
      sheet.getRange(product.rowNumber, headerMap['가용재고']).getValue() || 0,
    ),
    defectiveBefore: Number(
      sheet.getRange(product.rowNumber, headerMap['불량재고']).getValue() || 0,
    ),
    pendingStock: Number(sheet.getRange(product.rowNumber, headerMap['발송대기']).getValue() || 0),
  };
}

function applyInboundStock_(snapshot, availableAfter, defectiveAfter) {
  snapshot.sheet
    .getRange(snapshot.rowNumber, snapshot.headerMap['가용재고'])
    .setValue(availableAfter);
  snapshot.sheet
    .getRange(snapshot.rowNumber, snapshot.headerMap['불량재고'])
    .setValue(defectiveAfter);
  updateProductInventoryIndicators_(snapshot.sheet, snapshot.rowNumber, snapshot.headerMap, {
    availableStock: availableAfter,
    pendingStock: snapshot.pendingStock,
    safetyStock: Number(
      snapshot.sheet.getRange(snapshot.rowNumber, snapshot.headerMap['안전재고']).getValue() || 0,
    ),
  });
}

function finishInboundTask_(pendingSheet, rowNumber, originalRecord, recovery) {
  const taskId = recovery.taskId;
  if (!inventoryHistoryHasTask_(taskId)) {
    appendInventoryHistory_([
      {
        type: normalizeWorkflowText_(originalRecord['입고구분']) || '입고',
        productCode: recovery.productCode,
        productName: normalizeWorkflowText_(originalRecord['상품명']),
        option: normalizeWorkflowText_(originalRecord['옵션']),
        availableDelta: Number(recovery.availableAfter) - Number(recovery.availableBefore),
        pendingDelta: 0,
        availableAfter: Number(recovery.availableAfter),
        pendingAfter: Number(getInboundStockSnapshot_(originalRecord).pendingStock),
        note: `정상 ${originalRecord['정상수량']} / 불량 ${originalRecord['불량수량']}`,
        taskId,
      },
    ]);
  }

  const headerMap = getHeaderIndexMap_(pendingSheet);
  setSheetCellByHeader_(pendingSheet, rowNumber, headerMap, '처리상태', INBOUND_STATUS.completed);
  setSheetCellByHeader_(pendingSheet, rowNumber, headerMap, '오류사유', '');
  setWorkflowExecution_(pendingSheet, rowNumber, headerMap);
  moveWorkflowRow_(pendingSheet, getSheet_(CONFIG.sheets.inboundCompleted), rowNumber);
}

function moveInboundToError_(sourceSheet, rowNumber, status, message) {
  const headerMap = getHeaderIndexMap_(sourceSheet);
  setSheetCellByHeader_(sourceSheet, rowNumber, headerMap, '처리상태', status);
  setSheetCellByHeader_(sourceSheet, rowNumber, headerMap, '오류사유', message);
  setWorkflowExecution_(sourceSheet, rowNumber, headerMap);
  moveWorkflowRow_(sourceSheet, getSheet_(CONFIG.sheets.inboundErrors), rowNumber);
}

function moveWorkflowRow_(sourceSheet, targetSheet, rowNumber) {
  const values = sourceSheet.getRange(rowNumber, 1, 1, INBOUND_WORK_HEADERS.length).getValues()[0];
  targetSheet.appendRow(values);
  sourceSheet.deleteRow(rowNumber);
}

function inventoryHistoryHasTask_(taskId) {
  return getExistingValueSet_(getSheet_(CONFIG.sheets.inventoryHistory), '관련작업ID').has(taskId);
}

function isInboundTaskCompleted_(taskId) {
  return getExistingValueSet_(getSheet_(CONFIG.sheets.inboundCompleted), '입고작업ID').has(taskId);
}

function findInboundByRegistrationId_(registrationId) {
  return [
    CONFIG.sheets.inboundPending,
    CONFIG.sheets.inboundCompleted,
    CONFIG.sheets.inboundErrors,
  ].some((sheetName) =>
    getExistingValueSet_(getSheet_(sheetName), '등록작업ID').has(registrationId),
  );
}

function getWorkflowRecords_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  if (lastRow <= 1 || lastColumn === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(normalizeHeader_);
  const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map((row, index) => {
    const record = {};
    headers.forEach((header, columnIndex) => {
      if (header) record[header] = row[columnIndex];
    });
    return { rowNumber: index + 2, record };
  });
}

function setWorkflowResult_(sheet, rowNumber, status, errors) {
  const headerMap = getHeaderIndexMap_(sheet);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '처리상태', status);
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '오류사유', (errors || []).join(' / '));
  setWorkflowExecution_(sheet, rowNumber, headerMap);
}

function setWorkflowExecution_(sheet, rowNumber, headerMap) {
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '실행자', getWorkflowExecutorEmail_());
  setSheetCellByHeader_(sheet, rowNumber, headerMap, '실행시각', new Date());
}

function getWorkflowExecutorEmail_() {
  try {
    return Session.getEffectiveUser().getEmail() || Session.getActiveUser().getEmail() || '';
  } catch (error) {
    return '';
  }
}

function createWorkflowId_(prefix) {
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    'yyyyMMdd-HHmmss',
  );
  return `${prefix}-${timestamp}-${Utilities.getUuid().slice(0, 8).toUpperCase()}`;
}

function countWorkflowValues_(records, header) {
  return records.reduce((counts, item) => {
    const value = normalizeWorkflowText_(item.record[header]);
    if (value) counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function isWorkflowRecordEmpty_(record, headers) {
  return headers.every((header) => isBlankWorkflowValue_(record[header]));
}

function isBlankWorkflowValue_(value) {
  return value === '' || value === null || value === undefined;
}

function normalizeWorkflowText_(value) {
  return String(value ?? '').trim();
}

function parseNonNegativeInteger_(value) {
  if (isBlankWorkflowValue_(value)) return null;
  const normalized = String(value).trim().replace(/,/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isSafeInteger(number) ? number : null;
}

function isValidWorkflowDate_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return !Number.isNaN(value.getTime());
  }
  const match = String(value || '')
    .trim()
    .match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}
