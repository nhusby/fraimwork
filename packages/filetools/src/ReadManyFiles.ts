import { Tool } from "@fraimwork/core";
import * as fs from "fs/promises";
import { glob } from "glob";

/**
 * Reads multiple files based on glob patterns and filtering options
 */
export function readManyFiles(): Tool {
  return new Tool(
    {
      name: "ReadManyFiles",
      description:
        "Read multiple files based on glob patterns, with support for include/exclude filters, gitignore respect, and default exclusions. Returns the content of all matching files with their paths.",
      parameters: {
        paths: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "An array of file paths or directory paths to search within. Paths are relative to the current directory. Glob patterns can be used directly in these paths (e.g., ['src/**/*.ts', 'docs/*.md']).",
        },
        include: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "Optional. Glob patterns for files to include. These are effectively combined with the paths. Example: ['*.ts', 'src/**/*.md']",
        },
        exclude: {
          type: "array",
          items: {
            type: "string",
          },
          description:
            "Optional. Glob patterns for files/directories to exclude. Applied as ignore patterns. Example: ['*.log', 'dist/**']",
        },
        recursive: {
          type: "boolean",
          description:
            "Optional. Search directories recursively. This is generally controlled by glob patterns (e.g., **). The glob implementation is recursive by default for **. For simplicity, we'll rely on ** for recursion. Defaults to true.",
        },
        useDefaultExcludes: {
          type: "boolean",
          description:
            "Optional. Apply default exclusion patterns (node_modules, .git, dist, build, etc.). Defaults to true.",
        },
        respect_git_ignore: {
          type: "boolean",
          description:
            "Optional. Whether to respect .gitignore patterns. Defaults to true.",
        },
      },
      required: ["paths"],
    },
    async (args: Record<string, any>) => {
      const {
        paths,
        include = [],
        exclude = [],
        useDefaultExcludes = true,
        respect_git_ignore = true,
      } = args as {
        paths: string[];
        include?: string[];
        exclude?: string[];
        recursive?: boolean;
        useDefaultExcludes?: boolean;
        respect_git_ignore?: boolean;
      };

      try {
        // Default exclusion patterns
        const defaultExcludes = [
          "node_modules/**",
          ".git/**",
          "dist/**",
          "build/**",
          "coverage/**",
          ".nyc_output/**",
          "*.log",
          ".DS_Store",
          "Thumbs.db",
          "*.tmp",
          "*.temp",
          ".env",
          ".env.*",
          "*.min.js",
          "*.min.css",
        ];

        // Build the final exclude patterns
        let finalExcludes = [...exclude];
        if (useDefaultExcludes) {
          finalExcludes = [...finalExcludes, ...defaultExcludes];
        }

        // Read .gitignore if it exists and respect_git_ignore is true
        let gitignorePatterns: string[] = [];
        if (respect_git_ignore) {
          try {
            const gitignoreContent = await fs.readFile(".gitignore", "utf-8");
            gitignorePatterns = gitignoreContent
              .split("\n")
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith("#"))
              .map((line) => {
                // Convert gitignore patterns to glob patterns
                if (line.endsWith("/")) {
                  return line + "**";
                }
                if (!line.includes("/") && !line.includes("*")) {
                  return "**/" + line;
                }
                return line;
              });
            finalExcludes = [...finalExcludes, ...gitignorePatterns];
          } catch (error) {
            // .gitignore doesn't exist or can't be read, continue without it
          }
        }

        // Combine paths and include patterns
        const allPatterns = [...paths, ...include];

        // Collect all matching files
        const allFiles = new Set<string>();

        for (const pattern of allPatterns) {
          try {
            const files = await glob(pattern, {
              ignore: finalExcludes,
              dot: false, // Don't include hidden files by default
              nodir: true, // Only return files, not directories
            });
            files.forEach((file) => allFiles.add(file));
          } catch (error: any) {
            console.warn(
              `Warning: Error processing pattern "${pattern}": ${error.message}`,
            );
          }
        }

        if (allFiles.size === 0) {
          return "No files found matching the specified patterns.";
        }

        // Sort files for consistent output
        const sortedFiles = Array.from(allFiles).sort();

        // Read all files and format the output
        const results: Array<{
          path: string;
          content: string;
          error?: string;
        }> = [];

        for (const filePath of sortedFiles) {
          try {
            const content = await fs.readFile(filePath, "utf-8");
            results.push({
              path: filePath,
              content: content,
            });
          } catch (error: any) {
            results.push({
              path: filePath,
              content: "",
              error: `Error reading file: ${error.message}`,
            });
          }
        }

        // Format the output
        let output = `Found ${results.length} file(s):\n\n`;

        for (const result of results) {
          output += `=== ${result.path} ===\n`;
          if (result.error) {
            output += `ERROR: ${result.error}\n`;
          } else {
            output += result.content;
          }
          output += "\n\n";
        }

        return output;
      } catch (error: any) {
        return `Error reading multiple files: ${error.message}`;
      }
    },
  );
}
