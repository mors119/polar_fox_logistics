function parseOrderCsv(file) {
  let text = file.getBlob().getDataAsString("UTF-8");

  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }

  const table = Utilities.parseCsv(text);
  const nonEmptyRows = table.filter(row =>
    row.some(value => String(value ?? "").trim() !== "")
  );

  if (nonEmptyRows.length === 0) {
    return {
      headers: [],
      rows: []
    };
  }

  const headers = nonEmptyRows[0].map(normalizeHeader_);
  const rows = nonEmptyRows.slice(1).map((row, index) => {
    const mapped = {
      rowNumber: index + 2
    };

    headers.forEach((header, columnIndex) => {
      mapped[header] = String(row[columnIndex] ?? "").trim();
    });

    return mapped;
  });

  return {
    headers,
    rows
  };
}
