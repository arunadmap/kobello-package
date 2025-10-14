interface FileDetails {
    path: string;
    name: string;
    size: number;
    createdAt: string;
    ino: number;
    uid: number;
    ext: string;
    content?: string;
}

interface FileContentResponse {
    message: string;
    file: FileDetails;
}

declare function getFile(fileName: string, filePath: string): Promise<FileContentResponse | null>;

interface UpdateFileRequest {
    fileName: string;
    filePath: string;
    content: string;
}
interface UpdateFileResponse {
    message: string;
    file: FileDetails;
}

declare function updateFile(data: UpdateFileRequest): Promise<UpdateFileResponse>;

interface CreateFileRequest {
    fileName: string;
    filePath: string;
    content: string;
}
interface CreateFileResponse {
    message: string;
    file: {
        path: string;
        [key: string]: any;
    };
}

declare function createFile(data: CreateFileRequest): Promise<CreateFileResponse | null>;

interface DeleteFileRequest {
    fileName: string;
    filePath: string;
}
interface DeleteFileResponse {
    message: string;
    file: {
        path: string;
        [key: string]: any;
    };
}

declare function deleteFile(data: DeleteFileRequest): Promise<DeleteFileResponse | null>;

export { FileContentResponse, UpdateFileRequest, UpdateFileResponse, createFile, deleteFile, getFile, updateFile };
