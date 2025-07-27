import { Tool } from "@fraimwork/core";
import { typeCheck } from "@fraimwork/codetools";
import { askAgent } from "./askAgent.ts";
import { JrDevAgent } from "../agents/JrDevAgent.ts";

const typeCheckTool = typeCheck();
const agentTool = askAgent(JrDevAgent, "JrDevAgent");
const tbt = "```";

/**
 * Tool that combines TypeScript type checking with JrDevAgent to fix errors
 */
export function fixTypeErrors(): Tool {
  return new Tool(
    {
      name: "fixTypeErrors",
      description: "Fix all TypeScript type errors in source files",
      parameters: {},
    },
    async () => {
      try {
        const initialResult = await typeCheckTool.call();

        if (initialResult === "No type errors found") {
          return "No type errors found to fix.";
        }

        let errors: string[];
        try {
          errors = JSON.parse(initialResult);
        } catch (parseError) {
          return `Error parsing type check results: ${parseError instanceof Error ? parseError.message : String(parseError)}`;
        }

        // Extract file paths from error messages
        // Error format: "src/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'."
        const fileRegex = /^([^:(]+)\(\d+,\d+\):/;
        const errorsByFile: Record<string, string[]> = {};

        errors.forEach((error) => {
          const match = error.match(fileRegex);
          if (match) {
            const filePath = match[1];
            if (!errorsByFile[filePath]) {
              errorsByFile[filePath] = [];
            }
            errorsByFile[filePath]!.push(error);
          }
        });

        // Process each file with errors
        const results: string[] = [];
        for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
          results.push(`Processing ${filePath}...`);

          // Create a concise error report for the agent
          const errorReport = fileErrors.join("\n");
          const agentRequest = `There are TypeScript errors in ${filePath}. 
${tbt}
${errorReport}
${tbt}
Please read the file and fix the errors. When done, provide a very brief description of the problem and solution.`;

          console.log(agentRequest);

          try {
            const agentResponse = await agentTool.call({
              request: agentRequest,
            });
            console.log(agentResponse);
            results.push(`Fixed ${filePath}`);
          } catch (agentError) {
            results.push(
              `Error fixing ${filePath}: ${agentError instanceof Error ? agentError.message : String(agentError)}`,
            );
          }
        }

        // If we couldn't parse any file-specific errors, send all errors to the agent
        if (Object.keys(errorsByFile).length === 0) {
          results.push("Processing all errors together...");

          const errorReport = errors.join("\n");
          const agentTool = askAgent(JrDevAgent, "JrDevAgent");
          const agentRequest = `Fix the following TypeScript errors:\n\n${errorReport}\n\nIdentify the relevant files, read them, fix the errors, and save the corrected code. Do not explain, just fix.`;

          try {
            const agentResponse = await agentTool.call({
              request: agentRequest,
            });
            results.push(`Processed all errors`);
          } catch (agentError) {
            results.push(
              `Error processing errors: ${agentError instanceof Error ? agentError.message : String(agentError)}`,
            );
          }
        }

        return results.join("\n");
      } catch (error) {
        return `Error fixing type errors: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  );
}
