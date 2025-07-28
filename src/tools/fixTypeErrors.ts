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
      description: "Fix all TypeScript errors",
      parameters: {
        maxIterations: {
          type: "number",
          description: "Maximum number of iterations to attempt fixing errors",
          default: 5,
        },
      },
    },
    async (args: Record<string, any>) => {
      const { maxIterations = 5 } = args as {
        maxIterations: number;
      };

      try {
        let iteration = 0;
        let results: string[] = [];
        
        // Loop until no errors or max iterations reached
        while (iteration < maxIterations) {
          iteration++;
          results.push(`Iteration ${iteration}:`);
          
          // Check for errors
          const checkResult = await typeCheckTool.call({});
          
          // If no errors, break the loop
          if (checkResult === "No type errors found") {
            results.push("No type errors found. Done.");
            break;
          }
          
          // Parse the errors (now an array of strings)
          let errors: string[];
          
          try {
            errors = JSON.parse(checkResult);
          } catch (parseError) {
            results.push(`Error parsing type check results: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
            break;
          }
          
          results.push(`Found ${errors.length} errors`);
          
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
          let filesProcessed = 0;
          for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
            filesProcessed++;
            results.push(`Processing ${filePath} (${fileErrors.length} errors)...`);
            
            // Create a concise error report for the agent
            const errorReport = fileErrors.join("\n");
            const agentRequest = `There are TypeScript errors in ${filePath}. 
${tbt}
${errorReport}
${tbt}
When done, provide a very brief description of the problems and what you did to fix them.`;

            console.log(agentRequest);

            try {
              const agentResponse = await agentTool.call({
                request: agentRequest,
              });
              console.log({agentResponse});
              results.push(`Fixed ${filePath}`);
            } catch (agentError) {
              results.push(
                `Error fixing ${filePath}: ${agentError instanceof Error ? agentError.message : String(agentError)}`,
              );
            }
          }
          
          // If we couldn't parse any file-specific errors, send all errors to the agent
          if (Object.keys(errorsByFile).length === 0 && errors.length > 0) {
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
          
          // If no files were processed in this iteration, break to avoid infinite loop
          if (filesProcessed === 0 && Object.keys(errorsByFile).length === 0) {
            results.push("No files processed. Breaking loop.");
            break;
          }
        }
        
        if (iteration >= maxIterations) {
          results.push(`Reached maximum iterations (${maxIterations}) without fixing all errors.`);
        }
        
        return results.join("\n");
      } catch (error) {
        return `Error fixing type errors: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  );
}
