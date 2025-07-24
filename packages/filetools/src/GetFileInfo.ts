import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";

/**
 * Gets information about a file or directory
 */
export function getFileInfo(): Tool {
  return new Tool(
    {
      name: "GetFileInfo",
      description: "Get information about a file or directory",
      parameters: {
        path: {
          type: "string",
          description: "The path to the file or directory",
        },
      },
      required: ["path"],
    },
    async (args: Record<string, any>) => {
      const { path: filePath } = args as { path: string };
      try {
        const stats = await fs.stat(filePath);
        return JSON.stringify(
          {
            path: filePath,
            size: stats.size,
            isDirectory: stats.isDirectory(),
            isFile: stats.isFile(),
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime,
          },
          null,
          2,
        );
      } catch (error: any) {
        return `Error getting file info: ${error.message}`;
      }
    },
  );
}
