export interface MenuItem {
  readonly label: string;
  readonly functionName: string;
}

export interface UiPort {
  createMenu(title: string, items: ReadonlyArray<MenuItem>): void;
  alert(title: string, message: string): void;
}
