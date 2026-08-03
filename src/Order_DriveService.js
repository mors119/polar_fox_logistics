// 성공한 주문 파일은 처리완료 폴더로 옮긴다.
function moveProcessedFile(file) {
  file.moveTo(getConfiguredFolder_(ORDER_CONFIG.properties.processedFolderId));
}

// 실패한 주문 파일은 오류 폴더로 옮긴다.
function moveErrorFile(file) {
  file.moveTo(getConfiguredFolder_(ORDER_CONFIG.properties.errorFolderId));
}

// 주문 흐름 전용 입력 폴더를 가져온다.
function getOrderInputFolder_() {
  return getConfiguredFolder_(ORDER_CONFIG.properties.inputFolderId);
}
