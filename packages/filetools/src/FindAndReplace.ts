import * as fs from "fs/promises";
import { Tool } from "@fraimwork/core";

/**
 * Find and replace text across multiple files
 */
export function findAndReplace(): Tool {
  return new Tool(
    {
      name: "FindAndReplace",
      description:
        "Find and replace text across multiple files. Performs simple string replacement on all specified files.",
      parameters: {
        files: {
          type: "array",
          items: {
            type: "string",
          },
          description: "Array of file paths to perform find and replace on.",
        },
        oldString: {
          type: "string",
          description:
            "The text to find and replace. Must match precisely, including whitespace and indentation.",
        },
        newString: {
          type: "string",
          description:
            "The new text to replace with. Must be exact and ensure the resulting code is correct.",
        },
      },
      required: ["files", "oldString", "newString"],
    },
    async (args: Record<string, any>) => {
      const { files, oldString, newString } = args as {
        files: string[];
        oldString: string;
        newString: string;
      };

      try {
        const results: string[] = [];
        let totalReplacements = 0;

        for (const filePath of files) {
          try {
            const currentContent = await fs.readFile(filePath, "utf-8");
            const normalizedContent = currentContent.replace(/\r\n/g, "\n");

            // Count occurrences
            const occurrences = (
              normalizedContent.match(
                new RegExp(
                  oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                  "g",
                ),
              ) || []
            ).length;

            if (occurrences > 0) {
              // Perform replacement
              const newContent = normalizedContent.replaceAll(
                oldString,
                newString,
              );
              await fs.writeFile(filePath, newContent, "utf-8");
              results.push(
                `${filePath}: ${occurrences} replacement${occurrences === 1 ? "" : "s"}`,
              );
              totalReplacements += occurrences;
            } else {
              results.push(`${filePath}: no matches found`);
            }
          } catch (error: any) {
            results.push(`${filePath}: Error - ${error.message}`);
          }
        }

        return `Find and replace completed.\nTotal replacements: ${totalReplacements}\nResults:\n${results.join("\n")}`;
      } catch (error: any) {
        return `Error in find and replace: ${error.message}`;
      }
    },
  );
}
