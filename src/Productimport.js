// 상품마스터 시트에 이미 존재하는 상품품목코드가 있는지 확인한다.
function assertNoDuplicateProductCodes_(products) {
  const sheet = getSheet_(CONFIG.sheets.products);
  const existingCodes = new Set();

  if (sheet.getLastRow() > 1) {
    sheet
      .getRange(2, 1, sheet.getLastRow() - 1, 1)
      .getDisplayValues()
      .flat()
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .forEach((code) => existingCodes.add(code));
  }

  const duplicates = products
    .map((product) => product['상품품목코드'])
    .filter((code) => existingCodes.has(code));

  if (duplicates.length > 0) {
    throw appError_(
      'DUPLICATE_PRODUCT_CODE',
      `이미 등록된 상품품목코드: ${[...new Set(duplicates)].join(', ')}`,
      'DUPLICATE_CHECK',
    );
  }
}

// 검증이 끝난 상품 목록을 시트에 일괄 저장한다.
function importProducts_(file, products) {
  if (products.length === 0) {
    return 0;
  }

  const sheet = getSheet_(CONFIG.sheets.products);
  const now = new Date();

  const values = products.map((product) => [
    ...PRODUCT_HEADERS.map((header) => convertProductValue_(header, product[header])),
    file.getId(),
    file.getName(),
    now,
  ]);

  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);

  return values.length;
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
