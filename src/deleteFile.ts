import type { DeleteFileRequest, DeleteFileResponse } from './types/deleteFileTypes';

async function deleteFile(data: DeleteFileRequest): Promise<DeleteFileResponse | null> {
    try {
        const response = await fetch('http://localhost:5050/api/v1/file/delete', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error deleting file:', errorData.error);
            return null;
        }

        const result: DeleteFileResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Request failed:', error);
        return null;
    }
}

export { deleteFile };