import * as fs from "fs/promises";
import {Tool} from "@fraimwork/core";


/**
 * Perform multiple edits within a single file
 */
export function multiEdit(): Tool {
    return new Tool(
        {
            name: "MultiEdit",
            description:
                "Perform multiple fenced edits within a single file. Each edit is applied sequentially, so later edits must account for changes made by earlier edits.",
            parameters: {
                path: {
                    type: "string",
                    description: "The file path to edit.",
                },
                edits: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            oldString: {
                                type: "string",
                                description:
                                    "The text to replace. Must match precisely, including whitespace and indentation.",
                            },
                            newString: {
                                type: "string",
                                description: "The new text to replace with.",
                            },
                        },
                        required: ["oldString", "newString"],
                    },
                    description:
                        "Array of edit operations to perform. Each edit contains oldString and newString properties.",
                },
            },
            required: ["path", "edits"],
        },
        async (args: Record<string, any>) => {
            const { path: filePath, edits } = args as {
                path: string;
                edits: Array<{ oldString: string; newString: string }>;
            };

            try {
                let currentContent: string;

                // Read the file
                try {
                    currentContent = await fs.readFile(filePath, "utf-8");
                    // Normalize line endings to LF for consistent processing
                    currentContent = currentContent.replace(/\r\n/g, "\n");
                } catch (error: any) {
                    if (error.code === "ENOENT") {
                        return `Error: File not found: ${filePath}`;
                    } else {
                        return `Error reading file: ${error.message}`;
                    }
                }

                const results: string[] = [];
                let totalReplacements = 0;

                // Apply each edit sequentially
                for (let i = 0; i < edits.length; i++) {
                    const { oldString, newString } = edits[i]!;

                    // Count occurrences of oldString in current content
                    const occurrences = (
                        currentContent.match(
                            new RegExp(oldString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
                        ) || []
                    ).length;

                    if (occurrences === 0) {
                        results.push(`Edit ${i + 1}: No matches found for specified text`);
                        continue;
                    }

                    if (occurrences > 1) {
                        results.push(
                            `Edit ${i + 1}: Warning - Found ${occurrences} occurrences, replacing all`,
                        );
                    }

                    // Perform the replacement
                    currentContent = currentContent.replaceAll(oldString, newString);
                    results.push(
                        `Edit ${i + 1}: ${occurrences} replacement${occurrences === 1 ? "" : "s"}`,
                    );
                    totalReplacements += occurrences;
                }

                // Write the final content
                await fs.writeFile(filePath, currentContent, "utf-8");

                return `MultiEdit completed on ${filePath}.\nTotal replacements: ${totalReplacements}\nResults:\n${results.join("\n")}`;
            } catch (error: any) {
                return `Error in multi-edit: ${error.message}`;
            }
        },
    );
}