import type { UiPort, MenuItem } from '../../../application/ports/ui.port';

export class AppsScriptUiAdapter implements UiPort {
  public createMenu(title: string, items: ReadonlyArray<MenuItem>): void {
    const ui = this.getUi();
    const menu = ui.createMenu(title);

    for (const item of items) {
      menu.addItem(item.label, item.functionName);
    }

    menu.addToUi();
  }

  public alert(title: string, message: string): void {
    this.getUi().alert(title, message, this.getUi().ButtonSet.OK);
  }

  private getUi(): GoogleAppsScript.Base.Ui {
    if (typeof SpreadsheetApp === 'undefined') {
      throw new Error('Spreadsheet UI is unavailable in the current Apps Script runtime.');
    }

    return SpreadsheetApp.getUi();
  }
}
