import * as fs from "fs/promises";
import { glob } from "glob";
import * as path from "path";
import { Tool } from "@fraimwork/core";

/**
 * Lightweight index for smaller models - just files, structure, and exports
 */
export function codeIndexLite(): Tool {
  return new Tool(
    {
      name: "index",
      description: "Index showing project structure and exported symbols only.",
      parameters: {
        directory: {
          type: "string",
          description:
            "The directory to index (default: 'src' if it exists, otherwise current directory)",
        },
      },
    },
    async (args: Record<string, any>) => {
      const { directory } = args as {
        directory?: string;
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
            dir = ".";
          }
        }

        const extensionList = [".ts", ".js", ".tsx", ".jsx"];
        const patterns = extensionList.map((ext) => `**/*${ext}`);
        const allFilesRelative: string[] = [];

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

        for (const pattern of patterns) {
          const files = await glob(pattern, {
            cwd: dir,
            dot: false,
            ignore: ignorePatterns,
            maxDepth: 10,
          });
          allFilesRelative.push(...files);
        }

        const allFiles =
          dir === "."
            ? allFilesRelative
            : allFilesRelative.map((file) => path.join(dir, file));

        // Limit files for safety
        if (allFiles.length > 1000) {
          return `Error: Too many files found (${allFiles.length}). Consider specifying a more specific directory.`;
        }

        const result: any = {
          totalFiles: allFiles.length,
          files: [],
          structure: {},
        };

        // Build simple directory structure
        for (const file of allFiles) {
          const parts = file.split(path.sep);
          let current = result.structure;

          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i]!;
            if (!current[part]) {
              current[part] = {};
            }
            current = current[part];
          }

          const fileName = parts[parts.length - 1]!;
          if (!current[fileName]) {
            current[fileName] = "file";
          }
        }

        // Extract only exported symbols (lightweight)
        for (const file of allFiles) {
          const fileData: any = {
            path: file,
            exports: {
              classes: [],
              functions: [],
            },
          };

          if ([".ts", ".js", ".tsx", ".jsx"].includes(path.extname(file))) {
            try {
              const stats = await fs.stat(file);
              if (stats.size > 5 * 1024 * 1024) {
                // Skip files larger than 5MB
                continue;
              }

              const content = await fs.readFile(file, "utf-8");
              const lines = content.split("\n");

              if (lines.length > 10000) {
                // Skip very large files
                continue;
              }

              // Extract only exported classes
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                const exportedClassMatch = line.match(
                  /^\s*export\s+(?:abstract\s+)?class\s+(\w+)/,
                );
                if (exportedClassMatch) {
                  fileData.exports.classes.push(exportedClassMatch[1]);
                }
              }

              // Extract only exported functions
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;

                // Exported function declarations
                const exportedFunctionMatch = line.match(
                  /^\s*export\s+(?:async\s+)?function\s+(\w+)/,
                );
                if (exportedFunctionMatch) {
                  fileData.exports.functions.push(exportedFunctionMatch[1]);
                  continue;
                }

                // Exported const/let/var functions
                const exportedConstMatch = line.match(
                  /^\s*export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\()/,
                );
                if (exportedConstMatch) {
                  fileData.exports.functions.push(exportedConstMatch[1]);
                  continue;
                }
              }

              // Extract from export statements
              const exportMatches = content.match(/export\s*\{([^}]+)\}/g);
              if (exportMatches) {
                for (const match of exportMatches) {
                  // @ts-ignore
                  const exports = match
                    .match(/\{([^}]+)\}/)?.[1]
                    .split(",")
                    .map((e) => e.trim().split(/\s+as\s+/)[0]!);
                  if (exports) {
                    for (const exp of exports) {
                      // Simple heuristic: if it starts with capital, likely a class
                      if (exp[0] === exp[0]?.toUpperCase()) {
                        fileData.exports.classes.push(exp);
                      } else {
                        fileData.exports.functions.push(exp);
                      }
                    }
                  }
                }
              }
            } catch (error) {
              // Skip files that can't be read
              continue;
            }
          }

          // Only include files that have exports
          if (
            fileData.exports.classes.length > 0 ||
            fileData.exports.functions.length > 0
          ) {
            result.files.push(fileData);
          }
        }

        return JSON.stringify(result, null, 2);
      } catch (error: any) {
        return `Error indexing code: ${error.message}`;
      }
    },
  );
}
