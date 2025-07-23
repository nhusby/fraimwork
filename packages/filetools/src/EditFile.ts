import * as fs from "fs/promises";
import * as path from "path";
import {Tool} from "@fraimwork/core";


/**
 * Edit a single file with fenced context validation
 */
export function editFile(): Tool {
    return new Tool(
        {
            name: "EditFile",
            description:
                "Edit a file by replacing existing text with new text. Enforces context validation with at least 3 lines or 40 characters before and after the replacement (except at file boundaries). Only allows a single replacement per call.  Edit will fail if there is more than one match for oldString",
            parameters: {
                path: {
                    type: "string",
                    description: "The file path to edit.",
                },
                oldString: {
                    type: "string",
                    description:
                        "The text to be replaced in the file. Must match precisely, including whitespace and indentation. Do not escape characters. Must include at least 3 lines or 40 characters of context before and after the target text (unless the content reaches the beginning or end of the file).",
                },
                newString: {
                    type: "string",
                    description:
                        "The new text to replace the old text in the file. Must be exact with correct whitespace. Do not escape characters.",
                },
            },
            required: ["path", "oldString", "newString"],
        },
        async (args: Record<string, any>) => {
            const {
                path: filePath,
                oldString,
                newString,
            } = args as {
                path: string;
                oldString: string;
                newString: string;
            };

            try {
                let currentContent: string;
                let isNewFile = false;

                // Check if file exists and read content
                try {
                    currentContent = await fs.readFile(filePath, "utf-8");
                    // Normalize line endings to LF for consistent processing
                    currentContent = currentContent.replace(/\r\n/g, "\n");
                } catch (error: any) {
                    if (error.code === "ENOENT") {
                        // File doesn't exist
                        if (oldString === "") {
                            // Creating a new file
                            isNewFile = true;
                            currentContent = "";
                        } else {
                            return `Error: File not found. Cannot apply edit. Use an empty oldString to create a new file: ${filePath}`;
                        }
                    } else {
                        return `Error reading file: ${error.message}`;
                    }
                }

                // Handle new file creation
                if (isNewFile) {
                    // Ensure the directory exists
                    const dir = path.dirname(filePath);
                    await fs.mkdir(dir, { recursive: true });

                    await fs.writeFile(filePath, newString, "utf-8");
                    return `Created new file: ${filePath}`;
                }

                // Handle editing existing file
                if (oldString === "") {
                    return `Error: Attempted to create a file that already exists: ${filePath}`;
                }

                // Find the position of the old string in the content
                const oldStringIndex = currentContent.indexOf(oldString);
                if (oldStringIndex === -1) {
                    return `Error: Could not find the string to replace in ${filePath}. The exact text in oldString was not found.`;
                }

                // Check if there are multiple occurrences
                const occurrences = (
                    currentContent.match(
                        new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                    ) || []
                ).length;

                if (occurrences > 1) {
                    return `Error: Found ${occurrences} occurrences of the text. EditFile only allows a single replacement. Use FindAndReplace for multiple replacements or make the oldString more specific.`;
                }

                // Validate context requirements
                const beforeContext = currentContent.substring(0, oldStringIndex);
                const afterContext = currentContent.substring(
                    oldStringIndex + oldString.length,
                );

                const beforeLines = beforeContext.split("\n").length - 1;
                const afterLines = afterContext.split("\n").length - 1;

                // Check if we have sufficient context (unless at file boundaries)
                const isAtStart = oldStringIndex === 0 || beforeContext.trim() === "";
                const isAtEnd =
                    oldStringIndex + oldString.length === currentContent.length ||
                    afterContext.trim() === "";

                if (!isAtStart && beforeContext.length < 40 && beforeLines < 3) {
                    return `Error: Insufficient context before replacement. Please include at least 3 lines or 40 characters of context before the target text (unless at file beginning).`;
                }

                if (!isAtEnd && afterContext.length < 40 && afterLines < 3) {
                    return `Error: Insufficient context after replacement. Please include at least 3 lines or 40 characters of context after the target text (unless at file end).`;
                }

                // Perform the replacement
                const newContent = currentContent.replace(oldString, newString);

                // Ensure the directory exists
                const dir = path.dirname(filePath);
                await fs.mkdir(dir, { recursive: true });

                // Write the modified content
                await fs.writeFile(filePath, newContent, "utf-8");

                return `Successfully modified file: ${filePath} (1 replacement)`;
            } catch (error: any) {
                return `Error editing file: ${error.message}`;
            }
        },
    );
}