"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var src_exports = {};
__export(src_exports, {
  createFile: () => createFile,
  deleteFile: () => deleteFile,
  getFile: () => getFile,
  updateFile: () => updateFile
});
module.exports = __toCommonJS(src_exports);

// src/getFile.ts
async function getFile(fileName, filePath) {
  try {
    const response = await fetch("http://localhost:5050/api/v1/file/get", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fileName, filePath })
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error fetching file content:", errorData.error);
      return null;
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Request failed:", error);
    return null;
  }
}

// src/updateFile.ts
async function updateFile(data) {
  const response = await fetch("http://localhost:5050/api/v1/file/update", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.message || "Failed to update file");
  }
  return response.json();
}

// src/createFile.ts
async function createFile(data) {
  try {
    const response = await fetch("http://localhost:5050/api/v1/file/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error creating file:", errorData.error);
      return null;
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Request failed:", error);
    return null;
  }
}

// src/deleteFile.ts
async function deleteFile(data) {
  try {
    const response = await fetch("http://localhost:5050/api/v1/file/delete", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error deleting file:", errorData.error);
      return null;
    }
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Request failed:", error);
    return null;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createFile,
  deleteFile,
  getFile,
  updateFile
});
