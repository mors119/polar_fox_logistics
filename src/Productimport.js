// 검증이 끝난 상품 목록은 기존 상품은 갱신하고, 없는 상품은 신규 행으로 추가한다.
function importProducts_(file, products) {
  if (products.length === 0) {
    return 0;
  }

  const sheet = getSheet_(CONFIG.sheets.products);
  const headerMap = getHeaderIndexMap_(sheet);
  const existingProducts = getExistingProductMap_(sheet);
  const now = new Date();
  const rowsToAppend = [];
  let affectedCount = 0;

  products.forEach((product) => {
    const productCode = String(product['상품품목코드'] || '').trim();
    const existingProduct = existingProducts[productCode];

    if (!existingProduct) {
      rowsToAppend.push([
        ...PRODUCT_HEADERS.map((header) => convertProductValue_(header, product[header])),
        file.getId(),
        file.getName(),
        now,
      ]);
      affectedCount += 1;
      return;
    }

    updateExistingProductRow_(sheet, headerMap, existingProduct.rowNumber, product, file, now);
    affectedCount += 1;
  });

  if (rowsToAppend.length > 0) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, rowsToAppend[0].length)
      .setValues(rowsToAppend);
  }

  return affectedCount;
}

// 숫자와 날짜는 시트에서 후속 활용이 쉽도록 타입을 맞춰 넣는다.
function convertProductValue_(header, value) {
  if (NUMERIC_HEADERS.includes(header)) {
    return value === '' ? 0 : Number(value.replace(/,/g, ''));
  }

  if (header === '유효기간' && value) {
    return new Date(value.replace(/\//g, '-') + 'T00:00:00');
  }

  return value;
}

// 기존 상품마스터 행은 숫자 필드는 누적하고, 일반 필드는 새 값이 있으면 갱신한다.
function updateExistingProductRow_(sheet, headerMap, rowNumber, product, file, now) {
  PRODUCT_HEADERS.forEach((header) => {
    const columnIndex = headerMap[header];

    if (!columnIndex) {
      return;
    }

    const nextValue = product[header];

    if (NUMERIC_HEADERS.includes(header)) {
      const currentValue = Number(sheet.getRange(rowNumber, columnIndex).getValue() || 0);
      const delta = nextValue === '' ? 0 : Number(String(nextValue).replace(/,/g, ''));
      sheet.getRange(rowNumber, columnIndex).setValue(currentValue + delta);
      return;
    }

    if (header === '유효기간') {
      if (nextValue) {
        sheet.getRange(rowNumber, columnIndex).setValue(
          new Date(String(nextValue).replace(/\//g, '-') + 'T00:00:00'),
        );
      }
      return;
    }

    if (String(nextValue || '').trim() !== '') {
      sheet.getRange(rowNumber, columnIndex).setValue(nextValue);
    }
  });

  setMappedProductCell_(sheet, rowNumber, headerMap, '원본파일ID', file.getId());
  setMappedProductCell_(sheet, rowNumber, headerMap, '원본파일명', file.getName());
  setMappedProductCell_(sheet, rowNumber, headerMap, '등록일시', now);
}

// 상품마스터를 상품품목코드 기준 맵으로 읽어 기존 행 갱신에 사용한다.
function getExistingProductMap_(sheet) {
  const records = getSheetRecords_(sheet);
  const map = {};

  records.forEach((record, index) => {
    const productCode = getRecordValueByAliases_(record, '상품품목코드');

    if (!productCode) {
      return;
    }

    map[productCode] = {
      rowNumber: index + 2,
      record,
    };
  });

  return map;
}

// 헤더명 기준으로 상품마스터 특정 셀을 갱신한다.
function setMappedProductCell_(sheet, rowNumber, headerMap, headerName, value) {
  const columnIndex = headerMap[headerName];

  if (columnIndex) {
    sheet.getRange(rowNumber, columnIndex).setValue(value);
  }
}
