import type { FileDetails } from './fileTypes';
export interface UpdateFileRequest {
    fileName: string;
    filePath: string;
    content: string;
}
export interface UpdateFileResponse {
    message: string;
    file: FileDetails;
}
