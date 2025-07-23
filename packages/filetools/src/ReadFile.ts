import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";

/**
 * Reads the content of a file
 */
export function readFile(): Tool {
    return new Tool(
        {
            name: "ReadFile",
            description: "Read a file",
            parameters: {
                path: {
                    type: "string",
                    description: "The file path",
                },
            },
            required: ["path"],
        },
        async (args: Record<string, any>) => {
            const { path } = args as { path: string };
            try {
                const content = await fs.readFile(path, "utf-8");
                return content;
            } catch (error: any) {
                return `Error reading file: ${error.message}`;
            }
        },
    );
}