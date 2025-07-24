import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

/**
 * Lists files and directories in a specified path
 */
export function listFiles(): Tool {
  return new Tool(
    {
      name: "ListFiles",
      description: "List files and directories in a specified path",
      parameters: {
        directory: {
          type: "string",
          description:
            "The directory path to list files from. Defaults to current directory if not specified.",
        },
        pattern: {
          type: "string",
          description:
            "Optional glob pattern to filter files (e.g., '**/*.ts' for all TypeScript files)",
        },
      },
    },
    async (args: Record<string, any>) => {
      const { directory, pattern } = args as {
        directory?: string;
        pattern?: string;
      };
      try {
        const dir = directory || ".";

        if (pattern) {
          const files = await glob(pattern, { cwd: dir, dot: true });
          return JSON.stringify(files, null, 2);
        } else {
          const files = await fs.readdir(dir, { withFileTypes: true });
          const result = files.map((file) => ({
            name: file.name,
            type: file.isDirectory() ? "directory" : "file",
            path: path.join(dir, file.name),
          }));
          return JSON.stringify(result, null, 2);
        }
      } catch (error: any) {
        return `Error listing files: ${error.message}`;
      }
    },
  );
}
