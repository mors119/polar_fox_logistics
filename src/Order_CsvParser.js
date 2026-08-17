// 주문 입력 파일을 읽어 헤더와 데이터 행 구조로 분리한다.
function parseOrderCsv(file, parsedTable) {
  const table = parsedTable || parseCsvFile_(file);
  // 완전히 비어 있는 줄은 이후 검증 대상에서 제외한다.
  const nonEmptyRows = table.filter((row) =>
    row.some((value) => String(value ?? '').trim() !== ''),
  );

  if (nonEmptyRows.length === 0) {
    return {
      headers: [],
      rows: [],
    };
  }

  // 각 데이터 행은 헤더명 기반 객체로 변환해 후속 단계에서 재사용한다.
  const headers = nonEmptyRows[0].map(normalizeHeader_);
  const rows = nonEmptyRows.slice(1).map((row, index) => {
    const mapped = {
      rowNumber: index + 2,
    };

    headers.forEach((header, columnIndex) => {
      mapped[header] = String(row[columnIndex] ?? '').trim();
    });

    return mapped;
  });

  return {
    headers,
    rows,
  };
}
