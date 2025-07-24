import * as fs from "fs/promises";
import { glob } from "glob";
import * as path from "path";
import { Tool } from "@fraimwork/core";

/**
 * Finds symbol definitions and references
 */
export function findSymbol(): Tool {
  return new Tool(
    {
      name: "FindSymbol",
      description:
        "Find definitions and references to a symbol (class, function, variable) in the codebase, including documentation blocks for definitions",
      parameters: {
        symbol: {
          type: "string",
          description: "The symbol name to search for",
        },
        directory: {
          type: "string",
          description:
            "The directory to search in (default: 'src' if it exists, otherwise current directory)",
        },
        type: {
          type: "string",
          enum: ["all", "definition", "reference"],
          description:
            "Type of search: 'all' for both definitions and references, 'definition' for definitions only, 'reference' for references only",
        },
      },
      required: ["symbol"],
    },
    async (args: Record<string, any>) => {
      const { symbol, directory, type } = args as {
        symbol: string;
        directory?: string;
        type?: string;
      };
      try {
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

        const searchType = type || "all";

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

        const files = await glob("**/*.{ts,js,tsx,jsx,py,java,cpp,c,h}", {
          cwd: dir,
          dot: false,
          ignore: ignorePatterns,
          maxDepth: 10,
        });

        // Safety check
        if (files.length > 5000) {
          return `Error finding symbol: Too many files found (${files.length}). Consider specifying a more specific directory.`;
        }
        const results: any = {
          symbol: symbol,
          definitions: [],
          references: [],
        };

        for (const file of files) {
          try {
            const content = await fs.readFile(path.join(dir, file), "utf-8");
            const lines = content.split("\n");

            // Helper function to extract documentation block before a line
            const extractDocBlock = (lineIndex: number): string | null => {
              let docLines: string[] = [];
              let currentIndex = lineIndex - 1;

              // Skip empty lines
              while (currentIndex >= 0 && lines[currentIndex]?.trim() === "") {
                currentIndex--;
              }

              // Check for JSDoc style comments (/** ... */)
              if (
                currentIndex >= 0 &&
                lines[currentIndex]?.trim().endsWith("*/")
              ) {
                while (currentIndex >= 0) {
                  const line = lines[currentIndex]!.trim();
                  docLines.unshift(line);
                  if (line.startsWith("/**") || line.startsWith("/*")) {
                    break;
                  }
                  currentIndex--;
                }

                // Validate it's a proper JSDoc block
                if (
                  docLines.length > 0 &&
                  (docLines[0]!.startsWith("/**") ||
                    docLines[0]!.startsWith("/*"))
                ) {
                  return docLines.join("\n").trim();
                }
              }

              // Check for single-line comments (//)
              currentIndex = lineIndex - 1;
              docLines = [];
              while (currentIndex >= 0 && lines[currentIndex]?.trim() === "") {
                currentIndex--;
              }

              while (currentIndex >= 0) {
                const line = lines[currentIndex]!.trim();
                if (line.startsWith("//")) {
                  docLines.unshift(line);
                  currentIndex--;
                } else {
                  break;
                }
              }

              if (docLines.length > 0) {
                return docLines.join("\n").trim();
              }

              return null;
            };

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i]!;
              const lineNumber = i + 1;

              // Check for definitions
              if (searchType === "all" || searchType === "definition") {
                const definitionPatterns = [
                  new RegExp(`(?:class|interface|type|enum)\\s+${symbol}\\b`),
                  new RegExp(`(?:function|const|let|var)\\s+${symbol}\\b`),
                  new RegExp(`${symbol}\\s*[:=]\\s*(?:function|\\(|\\{|class)`),
                ];

                for (const pattern of definitionPatterns) {
                  if (pattern.test(line)) {
                    const docBlock = extractDocBlock(i);
                    results.definitions.push({
                      file,
                      line: lineNumber,
                      content: line.trim(),
                      context: lines
                        .slice(
                          Math.max(0, i - 2),
                          Math.min(lines.length, i + 3),
                        )
                        .join("\n"),
                      documentation: docBlock,
                    });
                    break;
                  }
                }
              }

              // Check for references
              if (searchType === "all" || searchType === "reference") {
                const referencePattern = new RegExp(`\\b${symbol}\\b`);
                if (referencePattern.test(line)) {
                  // Avoid duplicating definitions
                  const isDefinition = results.definitions.some(
                    (def: any) => def.file === file && def.line === lineNumber,
                  );

                  if (!isDefinition) {
                    results.references.push({
                      file,
                      line: lineNumber,
                      content: line.trim(),
                    });
                  }
                }
              }
            }
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }

        return JSON.stringify(results, null, 2);
      } catch (error: any) {
        return `Error finding symbol: ${error.message}`;
      }
    },
  );
}
