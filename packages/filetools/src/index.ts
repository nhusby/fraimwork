// Individual tool exports
export { appendFile } from "./AppendFile.ts";
export { createDirectory } from "./CreateDirectory.ts";
export { deleteFile } from "./DeleteFile.ts";
export { editFile } from "./EditFile.ts";
export { findAndReplace } from "./FindAndReplace.ts";
export { getFileInfo } from "./GetFileInfo.ts";
export { listFiles } from "./ListFiles.ts";
export { multiEdit } from "./MultiEdit.ts";
export { readFile } from "./ReadFile.ts";
export { readManyFiles } from "./ReadManyFiles.ts";
export { renameFile } from "./RenameFile.ts";
export { search } from "./Search.ts";
export { writeFile } from "./WriteFile.ts";

// Import all tools for array exports
import { appendFile } from "./AppendFile.ts";
import { createDirectory } from "./CreateDirectory.ts";
import { deleteFile } from "./DeleteFile.ts";
import { editFile } from "./EditFile.ts";
import { findAndReplace } from "./FindAndReplace.ts";
import { getFileInfo } from "./GetFileInfo.ts";
import { listFiles } from "./ListFiles.ts";
import { multiEdit } from "./MultiEdit.ts";
import { readFile } from "./ReadFile.ts";
import { readManyFiles } from "./ReadManyFiles.ts";
import { renameFile } from "./RenameFile.ts";
import { search } from "./Search.ts";
import { writeFile } from "./WriteFile.ts";

// Array of all tools
export const all = [
    appendFile,
    createDirectory,
    deleteFile,
    editFile,
    findAndReplace,
    getFileInfo,
    listFiles,
    multiEdit,
    readFile,
    readManyFiles,
    renameFile,
    search,
    writeFile,
];

// Array of readonly tools (tools that don't modify files)
export const readonly = [
    getFileInfo,
    listFiles,
    readFile,
    readManyFiles,
    search,
];