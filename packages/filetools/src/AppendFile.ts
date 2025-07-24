import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";

/**
 * Appends content to a file
 */
export function appendFile(): Tool {
  return new Tool(
    {
      name: "AppendFile",
      description: "Append content to an existing file",
      parameters: {
        path: {
          type: "string",
          description: "The path to the file to append to",
        },
        content: {
          type: "string",
          description: "The content to append to the file",
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
        await fs.appendFile(filePath, content, "utf-8");
        return `Content appended to ${filePath} successfully`;
      } catch (error: any) {
        return `Error appending to file: ${error.message}`;
      }
    },
  );
}
