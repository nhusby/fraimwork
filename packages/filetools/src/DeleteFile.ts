import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";

/**
 * Deletes a file or directory
 */
export function deleteFile(): Tool {
  return new Tool(
    {
      name: "DeleteFile",
      description: "Delete a file or directory",
      parameters: {
        path: {
          type: "string",
          description: "The path to the file or directory to delete",
        },
        recursive: {
          type: "boolean",
          description:
            "Whether to recursively delete directories (default: false)",
        },
      },
      required: ["path"],
    },
    async (args: Record<string, any>) => {
      const { path: filePath, recursive } = args as {
        path: string;
        recursive?: boolean;
      };
      try {
        const stats = await fs.stat(filePath);

        if (stats.isDirectory()) {
          await fs.rm(filePath, {
            recursive: recursive ?? false,
            force: true,
          });
          return `Directory ${filePath} deleted successfully`;
        } else {
          await fs.unlink(filePath);
          return `File ${filePath} deleted successfully`;
        }
      } catch (error: any) {
        return `Error deleting file/directory: ${error.message}`;
      }
    },
  );
}
