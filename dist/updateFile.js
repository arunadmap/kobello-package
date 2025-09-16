"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFile = updateFile;
async function updateFile(data) {
    const response = await fetch("http://localhost:5050/api/v1/file/update", {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Failed to update file");
    }
    return response.json();
}
