// 처리 완료한 주문 입력 파일은 공통 success 폴더로 이동한다.
function moveOrderFileToSuccessFolder_(file) {
  moveFileToSuccessFolder_(file);
}

// 처리 실패한 주문 입력 파일은 공통 error 폴더로 이동한다.
function moveOrderFileToErrorFolder_(file) {
  moveFileToErrorFolder_(file);
}

// 기존 호출부도 공통 input 폴더를 사용한다.
function getOrderInputFolder_() {
  return getConfiguredFolder_(CONFIG.properties.inputFolderId);
}
