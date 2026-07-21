import type { DriveFileInput, DrivePort } from '../../../application/ports/drive.port';

export class DriveAdapter implements DrivePort {
  public ensureFolder(name: string, parentFolderId?: string): string {
    const parentFolder = parentFolderId ? DriveApp.getFolderById(parentFolderId) : DriveApp;
    const existingFolders = parentFolder.getFoldersByName(name);

    if (existingFolders.hasNext()) {
      return existingFolders.next().getId();
    }

    return parentFolder.createFolder(name).getId();
  }

  public createFile(input: DriveFileInput): string {
    const folder = input.folderId
      ? DriveApp.getFolderById(input.folderId)
      : DriveApp.getRootFolder();
    const file = input.mimeType
      ? folder.createFile(input.fileName, input.content, input.mimeType)
      : folder.createFile(input.fileName, input.content);

    return file.getId();
  }

  public uploadContent(fileId: string, content: string, mimeType = MimeType.PLAIN_TEXT): void {
    const file = DriveApp.getFileById(fileId);
    file.setContent(content);

    if (mimeType !== MimeType.PLAIN_TEXT) {
      const parentFolders = file.getParents();

      if (parentFolders.hasNext()) {
        const parentFolder = parentFolders.next();
        const replacement = parentFolder.createFile(file.getName(), content, mimeType);
        file.setTrashed(true);
        replacement.setName(file.getName());
      }
    }
  }
}
