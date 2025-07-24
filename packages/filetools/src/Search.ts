import { Tool } from "@fraimwork/core";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Searches for code patterns in files
 */
export function search(): Tool {
  return new Tool(
    {
      name: "Search",
      description: "Search for patterns in code files",
      parameters: {
        pattern: {
          type: "string",
          description: "The pattern to search for",
        },
        directory: {
          type: "string",
          description:
            "The directory to search in (default: current directory)",
        },
        filePattern: {
          type: "string",
          description:
            "Optional file pattern to limit search (e.g., '**/*.ts')",
        },
      },
      required: ["pattern"],
    },
    async (args: Record<string, any>) => {
      const { pattern, directory, filePattern } = args as {
        pattern: string;
        directory?: string;
        filePattern?: string;
      };
      try {
        const dir = directory || ".";
        const filePat = filePattern || "**/*";

        // Use grep on Unix-like systems or findstr on Windows
        const isWindows = process.platform === "win32";
        let command: string;

        if (isWindows) {
          command = `findstr /s /n /p "${pattern}" "${path.join(dir, filePat)}"`;
        } else {
          command = `grep -r --include="${filePat}" -n "${pattern}" ${dir}`;
        }

        const { stdout, stderr } = await execAsync(command);

        if (stderr) {
          return `Error during Search: ${stderr}`;
        }

        return stdout || "No matches found";
      } catch (error: any) {
        // grep returns exit code 1 when no matches are found, which causes exec to throw
        if (error.code === 1) {
          return "No matches found";
        }
        return `Error searching code: ${error.message}`;
      }
    },
  );
}
