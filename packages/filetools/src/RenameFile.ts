import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Renames a file or directory
 */
export function renameFile(): Tool {
  return new Tool(
    {
      name: "RenameFile",
      description: "Rename a file or directory",
      parameters: {
        oldPath: {
          type: "string",
          description: "The current path of the file or directory",
        },
        newPath: {
          type: "string",
          description: "The new path for the file or directory",
        },
      },
      required: ["oldPath", "newPath"],
    },
    async (args: Record<string, any>) => {
      const { oldPath, newPath } = args as {
        oldPath: string;
        newPath: string;
      };
      try {
        // Ensure the target directory exists
        const targetDir = path.dirname(newPath);
        await fs.mkdir(targetDir, { recursive: true });

        await fs.rename(oldPath, newPath);
        return `Renamed ${oldPath} to ${newPath} successfully`;
      } catch (error: any) {
        return `Error renaming file/directory: ${error.message}`;
      }
    },
  );
}
