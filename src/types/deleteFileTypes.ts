export interface DeleteFileRequest {
    fileName: string;
    filePath: string;
}

export interface DeleteFileResponse {
    message: string;
    file: {
        path: string;
        [key: string]: any;
    };
}
