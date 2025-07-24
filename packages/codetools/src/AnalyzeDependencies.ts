import * as fs from "fs/promises";
import { glob } from "glob";
import * as path from "path";
import { Tool } from "@fraimwork/core";

/**
 * Analyzes code dependencies
 */
export function analyzeDependencies(): Tool {
  return new Tool(
    {
      name: "AnalyzeDependencies",
      description: "Analyze dependencies between files in the project",
      parameters: {
        directory: {
          type: "string",
          description:
            "The directory to analyze (default: 'src' if it exists, otherwise current directory)",
        },
        file: {
          type: "string",
          description: "Specific file to analyze dependencies for (optional)",
        },
      },
    },
    async (args: Record<string, any>) => {
      const { directory, file } = args as {
        directory?: string;
        file?: string;
      };
      try {
        // Smart directory selection: prefer src if it exists when using current directory
        let dir = directory || ".";
        if (!directory || directory === "." || directory === "./") {
          try {
            const srcStats = await fs.stat("src");
            if (srcStats.isDirectory()) {
              dir = "src";
            }
          } catch {
            // src doesn't exist, use current directory
            dir = ".";
          }
        }

        const dependencies: any = {
          files: {},
          graph: {},
        };

        let filesToAnalyze: string[];

        if (file) {
          filesToAnalyze = [file];
        } else {
          // Define directories to ignore
          const ignorePatterns = [
            "**/node_modules/**",
            "**/.git/**",
            "**/.next/**",
            "**/dist/**",
            "**/build/**",
            "**/.cache/**",
            "**/coverage/**",
            "**/.nyc_output/**",
            "**/tmp/**",
            "**/temp/**",
            "**/.vscode/**",
            "**/.idea/**",
            "**/logs/**",
            "**/*.log",
          ];

          filesToAnalyze = await glob("**/*.{ts,js,tsx,jsx}", {
            cwd: dir,
            dot: false,
            ignore: ignorePatterns,
            maxDepth: 10,
          });

          // Safety check
          if (filesToAnalyze.length > 5000) {
            return `Error analyzing dependencies: Too many files found (${filesToAnalyze.length}). Consider specifying a more specific directory.`;
          }
        }

        for (const file of filesToAnalyze) {
          try {
            const content = await fs.readFile(path.join(dir, file), "utf-8");
            const imports: string[] = [];
            const exports: string[] = [];

            // Extract imports
            const importMatches = content.match(
              /import\s+(?:\{[^}]+\}|\w+|\*\s+as\s+\w+)\s+from\s+['"][^'"]+['"]/g,
            );
            if (importMatches) {
              for (const match of importMatches) {
                const fromMatch = match.match(/from\s+['"]([^'"]+)['"]/);
                if (fromMatch) {
                  imports.push(fromMatch[1]!);
                }
              }
            }

            // Extract exports
            const exportMatches = content.match(
              /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)|export\s*\{([^}]+)\}/g,
            );
            if (exportMatches) {
              for (const match of exportMatches) {
                if (match.includes("{")) {
                  // @ts-ignore
                  const exportNames = match
                    .match(/\{([^}]+)\}/)?.[1]
                    .split(",")
                    .map((e) => e.trim());
                  if (exportNames) {
                    exports.push(...exportNames);
                  }
                } else {
                  const exportName = match.match(
                    /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/,
                  )?.[1];
                  if (exportName) {
                    exports.push(exportName);
                  }
                }
              }
            }

            dependencies.files[file] = {
              imports,
              exports,
              importCount: imports.length,
              exportCount: exports.length,
            };

            dependencies.graph[file] = imports;
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }

        return JSON.stringify(dependencies, null, 2);
      } catch (error: any) {
        return `Error analyzing dependencies: ${error.message}`;
      }
    },
  );
}
