import type { FileContentResponse } from './types/getFileTypes';
declare function getFile(fileName: string, filePath: string): Promise<FileContentResponse | null>;
export { getFile };
