import type { FileDetails } from "./fileTypes";

export interface FileContentResponse {
    message: string;
    file: FileDetails;
}