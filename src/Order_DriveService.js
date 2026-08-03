function moveProcessedFile(file) {
  file.moveTo(getConfiguredFolder_(ORDER_CONFIG.properties.processedFolderId));
}

function moveErrorFile(file) {
  file.moveTo(getConfiguredFolder_(ORDER_CONFIG.properties.errorFolderId));
}

function getOrderInputFolder_() {
  return getConfiguredFolder_(ORDER_CONFIG.properties.inputFolderId);
}
