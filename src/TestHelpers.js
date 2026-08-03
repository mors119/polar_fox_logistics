function createSampleCsvFile() {
  const folder = getConfiguredFolder_(CONFIG.properties.inputFolderId);

  const rows = [
    PRODUCT_HEADERS,
    [
      'P00000KR000B',
      'FOX-BOOK-001',
      '북극여우',
      'https://example.com/book.jpg',
      '도서',
      '단품',
      '헌터 시즌1 1권',
      '헌터1권',
      '선택=1권',
      '880000000001',
      '입출고',
      '',
      'A-01-01',
      'A구역',
      '2027-12-31',
      '진행',
      '100',
      '5',
      '10',
      '0',
      '120',
      '95',
      '1권',
      '20',
    ],
  ];

  const csvText = rows.map((row) => row.map(escapeCsvCell_).join(',')).join('\n');

  const file = folder.createFile(`sample_products_${Date.now()}.csv`, csvText, MimeType.CSV);

  console.log(file.getUrl());
  return file.getUrl();
}

function escapeCsvCell_(value) {
  const text = String(value ?? '');

  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function runSmokeTest() {
  setupSystem();
  createSampleCsvFile();
  scanCsvInputFolder();
  console.log('스모크 테스트 완료');
}
