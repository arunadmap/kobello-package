"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFile = getFile;
async function getFile(fileName, filePath) {
    try {
        const response = await fetch('http://localhost:5050/api/v1/file/get', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileName, filePath }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Error fetching file content:', errorData.error);
            return null;
        }
        const data = await response.json();
        return data;
    }
    catch (error) {
        console.error('Request failed:', error);
        return null;
    }
}
