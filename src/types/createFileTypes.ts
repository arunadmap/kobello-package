export interface CreateFileRequest {
    fileName: string;
    filePath: string;
    content: string;
}

export interface CreateFileResponse {
    message: string;
    file: {
        path: string;
        [key: string]: any;
    };
}
