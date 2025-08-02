import { Tool, validatePath } from "@fraimwork/core";
import * as fs from "fs/promises";
import * as path from "path";

/**
 * Writes content to a file
 */
export function writeFile(): Tool {
  return new Tool(
    {
      name: "WriteFile",
      description:
        "Write a file (create or replace the entire contents of a file)",
      parameters: {
        path: {
          type: "string",
          description: "The file path",
        },
        content: {
          type: "string",
          description: "The content",
        },
      },
      required: ["path", "content"],
    },
    async (args: Record<string, any>) => {
      const { path: filePath, content } = args as {
        path: string;
        content: string;
      };
      try {
        // Validate that the file path is within the working directory
        const validatedPath = await validatePath(filePath);
        
        // Ensure the directory exists
        const dir = path.dirname(validatedPath);
        await fs.mkdir(dir, { recursive: true });

        await fs.writeFile(validatedPath, content, "utf-8");
        return `File ${filePath} written successfully`;
      } catch (error: any) {
        return `Error writing file: ${error.message}`;
      }
    },
  );
}
