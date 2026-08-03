// 처리 완료한 주문 입력 파일은 시트에 기록을 남긴 뒤 휴지통으로 보낸다.
function trashOrderFile_(file) {
  file.setTrashed(true);
}

// 주문 흐름 전용 입력 폴더를 가져온다.
function getOrderInputFolder_() {
  return getConfiguredFolder_(ORDER_CONFIG.properties.inputFolderId);
}
