// 주문 CSV는 헤더 존재 여부와 허용 컬럼 범위를 먼저 검증한다.
function validateCsv(parsedCsv) {
  const headers = Array.isArray(parsedCsv) ? parsedCsv : parsedCsv.headers;

  if (!headers || headers.length === 0) {
    throw appError_('EMPTY_CSV', 'CSV가 비어 있습니다.', 'CSV_VALIDATION');
  }

  const duplicateHeaders = findDuplicates_(headers);
  if (duplicateHeaders.length > 0) {
    throw appError_(
      'DUPLICATE_HEADER',
      `중복 헤더: ${duplicateHeaders.join(', ')}`,
      'CSV_VALIDATION',
    );
  }

  const missingHeaders = REQUIRED_ORDER_HEADERS.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw appError_(
      'MISSING_HEADER',
      `필수 헤더 누락: ${missingHeaders.join(', ')}`,
      'CSV_VALIDATION',
    );
  }

  const unknownHeaders = headers.filter((header) => header && !ORDER_CSV_HEADERS.includes(header));
  if (unknownHeaders.length > 0) {
    throw appError_(
      'UNKNOWN_HEADER',
      `지원하지 않는 헤더: ${unknownHeaders.join(', ')}`,
      'CSV_VALIDATION',
    );
  }
}

// 각 행의 필수값, 수량 형식, 주문번호 내부 일관성을 한 번에 검사한다.
function validateOrderRows(rows) {
  const errors = [];
  const seenOrderItemNumbers = new Set();
  const orderSnapshots = {};

  rows.forEach((row) => {
    const rowNumber = row.rowNumber;
    const orderNumber = getTrimmedField_(row, '주문번호');
    const orderItemNumber = getTrimmedField_(row, '품목별 주문번호');
    const productItemCode = getTrimmedField_(row, '상품품목코드');
    const orderItemName = getTrimmedField_(row, '주문상품명');
    const quantityText = getTrimmedField_(row, '수량');
    const recipient = getTrimmedField_(row, '수령인');
    const recipientAddress = getTrimmedField_(row, '수령인 주소');

    if (!orderNumber) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '주문번호는 필수입니다.',
        ),
      );
    }

    if (!orderItemNumber) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '품목별 주문번호는 필수입니다.',
        ),
      );
    } else if (seenOrderItemNumbers.has(orderItemNumber)) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'DUPLICATE_IN_FILE',
          'CSV 내부 품목별 주문번호가 중복되었습니다.',
        ),
      );
    } else {
      seenOrderItemNumbers.add(orderItemNumber);
    }

    if (!productItemCode) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '상품품목코드는 필수입니다.',
        ),
      );
    }

    if (!orderItemName) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '주문상품명은 필수입니다.',
        ),
      );
    }

    const quantityNumber = parseIntegerField_(quantityText);
    if (!quantityText) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '수량은 필수입니다.',
        ),
      );
    } else if (quantityNumber === null || quantityNumber < 1) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'INVALID_QUANTITY',
          `수량은 1 이상의 정수여야 합니다: ${quantityText}`,
        ),
      );
    }

    ORDER_NUMERIC_OPTIONAL_HEADERS.forEach((header) => {
      const rawValue = getTrimmedField_(row, header);
      if (!rawValue) {
        return;
      }

      const numberValue = parseNumberField_(rawValue);
      if (numberValue === null || numberValue < 0) {
        errors.push(
          buildOrderRowError_(
            rowNumber,
            orderNumber,
            orderItemNumber,
            'INVALID_NUMBER',
            `${header}은 비어 있거나 0 이상의 숫자여야 합니다: ${rawValue}`,
          ),
        );
      }
    });

    if (!recipient) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '수령인은 필수입니다.',
        ),
      );
    }

    if (!recipientAddress) {
      errors.push(
        buildOrderRowError_(
          rowNumber,
          orderNumber,
          orderItemNumber,
          'REQUIRED_VALUE',
          '수령인 주소는 필수입니다.',
        ),
      );
    }

    // 같은 주문번호 안에서 헤더 성격 필드는 모두 같은 값이어야 한다.
    if (orderNumber) {
      const snapshot = buildOrderHeaderSnapshot_(row);
      if (!orderSnapshots[orderNumber]) {
        orderSnapshots[orderNumber] = snapshot;
      } else {
        const inconsistentField = ORDER_HEADER_CONSISTENCY_FIELDS.find(
          (field) => orderSnapshots[orderNumber][field] !== snapshot[field],
        );

        if (inconsistentField) {
          errors.push(
            buildOrderRowError_(
              rowNumber,
              orderNumber,
              orderItemNumber,
              'INCONSISTENT_ORDER_HEADER',
              `같은 주문번호의 ${inconsistentField} 값이 서로 다릅니다.`,
            ),
          );
        }
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

// 오류 로그 시트에 바로 쓸 수 있는 표준 형태의 오류 객체를 만든다.
function buildOrderRowError_(rowNumber, orderNumber, orderItemNumber, code, message) {
  return {
    rowNumber,
    orderNumber: orderNumber || '',
    orderItemNumber: orderItemNumber || '',
    code,
    message,
  };
}

// 같은 주문번호끼리 비교할 필드만 뽑아 스냅샷으로 저장한다.
function buildOrderHeaderSnapshot_(row) {
  const snapshot = {};
  ORDER_HEADER_CONSISTENCY_FIELDS.forEach((field) => {
    snapshot[field] = getTrimmedField_(row, field);
  });
  return snapshot;
}
