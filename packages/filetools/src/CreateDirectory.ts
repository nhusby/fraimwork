import { Tool, validatePath } from "@fraimwork/core";
import * as fs from "fs/promises";

/**
 * Creates a new directory
 */
export function createDirectory(): Tool {
  return new Tool(
    {
      name: "CreateDirectory",
      description: "Create a new directory",
      parameters: {
        path: {
          type: "string",
          description: "The path of the directory to create",
        },
      },
      required: ["path"],
    },
    async (args: Record<string, any>) => {
      const { path: dirPath } = args as { path: string };
      try {
        // Validate that the directory path is within the working directory
        const validatedPath = await validatePath(dirPath);
        await fs.mkdir(validatedPath, { recursive: true });
        return `Directory ${dirPath} created successfully`;
      } catch (error: any) {
        return `Error creating directory: ${error.message}`;
      }
    },
  );
}
