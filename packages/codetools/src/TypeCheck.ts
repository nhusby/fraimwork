import * as fs from "fs/promises";
import * as path from "path";
import { Tool } from "@fraimwork/core";
import ts from "typescript";

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
    async (args: Record<string, any>) => {
      const { path: targetPath } = args as {
        path: string;
      };

      try {
        // Resolve the absolute path
        const absolutePath = path.resolve(targetPath);
        
        // Check if path exists
        try {
          await fs.access(absolutePath);
        } catch {
          return `Error: Path '${absolutePath}' does not exist`;
        }

        // Get file stats to determine if it's a file or directory
        const stats = await fs.stat(absolutePath);
        
        let filesToCheck: string[] = [];
        
        if (stats.isFile()) {
          if (!absolutePath.endsWith('.ts') && !absolutePath.endsWith('.tsx')) {
            return `Error: File '${absolutePath}' is not a TypeScript file`;
          }
          filesToCheck = [absolutePath];
        } else if (stats.isDirectory()) {
          // Find all TypeScript files in directory
          const getAllTsFiles = async (dir: string): Promise<string[]> => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(
              entries.map((entry) => {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  // Skip node_modules and other common directories
                  if (entry.name === 'node_modules' || 
                      entry.name === '.git' || 
                      entry.name === 'dist' || 
                      entry.name === 'build') {
                    return [];
                  }
                  return getAllTsFiles(fullPath);
                } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
                  return [fullPath];
                }
                return [];
              })
            );
            return files.flat();
          };
          
          filesToCheck = await getAllTsFiles(absolutePath);
        } else {
          return `Error: Path '${absolutePath}' is neither a file nor a directory`;
        }

        if (filesToCheck.length === 0) {
          return "No TypeScript files found to check";
        }

        // Create a program to type check the files
        const program = ts.createProgram(filesToCheck, {
          allowJs: false,
          checkJs: false,
          strict: true,
          noEmit: true,
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.ES2020,
          moduleResolution: ts.ModuleResolutionKind.Node16,
          esModuleInterop: true,
          skipLibCheck: true,
          resolveJsonModule: true,
        });

        // Get diagnostics (errors)
        const diagnostics = ts.getPreEmitDiagnostics(program);
        
        // Format diagnostics into a concise format
        const errors: Array<{
          file: string;
          line: number;
          character: number;
          message: string;
          code: number;
        }> = [];

        diagnostics.forEach((diagnostic) => {
          if (diagnostic.file && diagnostic.start) {
            const { line, character } = ts.getLineAndCharacterOfPosition(
              diagnostic.file,
              diagnostic.start
            );
            
            const message = ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n"
            );
            
            errors.push({
              file: diagnostic.file.fileName,
              line: line + 1,
              character: character + 1,
              message,
              code: diagnostic.code,
            });
          } else {
            const message = ts.flattenDiagnosticMessageText(
              diagnostic.messageText,
              "\n"
            );
            
            errors.push({
              file: "unknown",
              line: 0,
              character: 0,
              message,
              code: diagnostic.code,
            });
          }
        });

        if (errors.length === 0) {
          return "No type errors found";
        }

        // Return formatted errors
        return JSON.stringify(errors, null, 2);
      } catch (error: any) {
        return `Error during type checking: ${error.message}`;
      }
    },
  );
}