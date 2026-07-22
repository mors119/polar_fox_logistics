export interface MenuItem {
  readonly label: string;
  readonly functionName: string;
}

function getUi(): GoogleAppsScript.Base.Ui {
  if (typeof SpreadsheetApp === 'undefined') {
    throw new Error('Spreadsheet UI is unavailable in the current Apps Script runtime.');
  }

  return SpreadsheetApp.getUi();
}

export function createMenu(title: string, items: ReadonlyArray<MenuItem>): void {
  const menu = getUi().createMenu(title);

  for (const item of items) {
    menu.addItem(item.label, item.functionName);
  }

  menu.addToUi();
}

export function showAlert(title: string, message: string): void {
  const ui = getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}
