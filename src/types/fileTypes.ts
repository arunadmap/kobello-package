export interface FileDetails {
    path: string;
    name: string;
    size: number;
    createdAt: string;
    ino: number;
    uid: number;
    ext: string;
    content?: string;
}