import type { CreateFileRequest, CreateFileResponse } from './types/createFileTypes';

async function createFile(data: CreateFileRequest): Promise<CreateFileResponse | null> {
    try {
        const response = await fetch('http://localhost:5050/api/v1/file/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error creating file:', errorData.error);
            return null;
        }

        const result: CreateFileResponse = await response.json();
        return result;
    } catch (error) {
        console.error('Request failed:', error);
        return null;
    }
}

export { createFile };