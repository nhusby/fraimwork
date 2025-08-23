import { Tool } from "@fraimwork/core";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);
/**
 * Type checks a TypeScript file or directory and returns errors
 */
export function typeCheck(): Tool {
  return new Tool(
    {
      name: "TypeCheck",
      description: "Type check TypeScript files and return errors",
      parameters: {
        path: {
          type: "string",
          description: "Path to file or directory to type check",
        },
      },
    },
    async (args: { path?: string }) => {
      const { path } = args || {};

      // Run npx tsc with appropriate flags
      const command = `npx tsc --noEmit ${!path ? "" : path.match(/tsx?$/) ? path : `${path}**/*.ts`}`;

      try {
        const { stdout, stderr } = await execPromise(command, {
          cwd: process.cwd(),
          maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        });

        // If there's output in stderr, it might contain errors
        if (stderr) {
          // Filter out non-error messages
          const errorLines = stderr
            .split("\n")
            .filter((line: string) =>
                line.includes("error TS") ||
                (line.includes(":") && line.includes("error")),
            );

          if (errorLines.length > 0) {
            return JSON.stringify(errorLines, null, 2);
          }
        }

        // If there's output in stdout, it might contain errors
        if (stdout) {
          const errorLines = stdout
            .split("\n")
            .filter((line: string) =>
                line.includes("error TS") ||
                (line.includes(":") && line.includes("error")),
            );

          if (errorLines.length > 0) {
            return JSON.stringify(errorLines, null, 2);
          }
        }

        return "No type errors found";
      } catch (execError: any) {
        // Parse the error output to extract meaningful information
        if (execError.stderr || execError.stdout) {
          const output = execError.stderr || execError.stdout;
          const errorLines = output
            .split("\n")
            .filter((line: string) =>
                line.includes("error TS") ||
                (line.includes(":") && line.includes("error")),
            );

          if (errorLines.length > 0) {
            return JSON.stringify(errorLines, null, 2);
          }

          return `TypeScript compilation failed: ${output}`;
        }

        return `Error during type checking: ${execError.message}`;
      }
    },
  );
}
