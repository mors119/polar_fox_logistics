function createSampleOrderCsv() {
  const folder = getOrderInputFolderForSample_();
  const rows = [
    ORDER_CSV_HEADERS,
    [
      '카페24',
      'SHOP-001',
      'ORD-1001',
      'ORD-1001-01',
      '문 앞에 놓아주세요',
      '25000',
      '25000',
      'P00001',
      '북극여우 키링',
      '파랑',
      '2',
      '5000',
      '김희성',
      '010-1234-5678',
      '12345',
      '서울특별시 테스트구 테스트로 1',
    ],
    [
      '카페24',
      'SHOP-001',
      'ORD-1001',
      'ORD-1001-02',
      '문 앞에 놓아주세요',
      '25000',
      '25000',
      'P00002',
      '북극여우 머그컵',
      '기본',
      '1',
      '15000',
      '김희성',
      '010-1234-5678',
      '12345',
      '서울특별시 테스트구 테스트로 1',
    ],
  ];

  return createOrderCsvFromRows_(rows, `sample_orders_${Date.now()}.csv`);
}

function createOrderCsvFromRows_(rows, fileName) {
  const folder = getOrderInputFolderForSample_();
  const csvText = rows.map((row) => row.map(escapeCsvCell_).join(',')).join('\n');

  const file = folder.createFile(fileName, csvText, MimeType.CSV);
  console.log(file.getUrl());
  return file.getUrl();
}

function runOrderImportSmokeTest() {
  setupOrderCsvSystem();
  createSampleOrderCsv();
  scanOrderFolder();
  console.log('주문 CSV 스모크 테스트 완료');
}

function getOrderInputFolderForSample_() {
  const propertyKey = ORDER_CONFIG.properties.inputFolderId;
  const scriptProperties = PropertiesService.getScriptProperties();

  if (!scriptProperties.getProperty(propertyKey)) {
    setupOrderCsvSystem();
  }

  return getConfiguredFolder_(propertyKey);
}
