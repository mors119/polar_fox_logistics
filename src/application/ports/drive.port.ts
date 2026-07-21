export interface DriveFileInput {
  readonly folderId?: string;
  readonly fileName: string;
  readonly content: string;
  readonly mimeType?: string;
}

export interface DrivePort {
  ensureFolder(name: string, parentFolderId?: string): string;
  createFile(input: DriveFileInput): string;
  uploadContent(fileId: string, content: string, mimeType?: string): void;
}
