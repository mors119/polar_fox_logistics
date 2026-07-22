export interface DriveFileInput {
  readonly folderId?: string;
  readonly fileName: string;
  readonly content: string;
  readonly mimeType?: string;
}

export function ensureDriveFolder(name: string, parentFolderId?: string): string {
  const parentFolder = parentFolderId ? DriveApp.getFolderById(parentFolderId) : DriveApp;
  const existingFolders = parentFolder.getFoldersByName(name);

  if (existingFolders.hasNext()) {
    return existingFolders.next().getId();
  }

  return parentFolder.createFolder(name).getId();
}

export function createDriveFile(input: DriveFileInput): string {
  const folder = input.folderId ? DriveApp.getFolderById(input.folderId) : DriveApp.getRootFolder();
  const file = input.mimeType
    ? folder.createFile(input.fileName, input.content, input.mimeType)
    : folder.createFile(input.fileName, input.content);

  return file.getId();
}
