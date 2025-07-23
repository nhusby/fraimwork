import * as fs from "fs/promises";
import { glob } from "glob";
import * as path from "path";
import {Tool} from "@fraimwork/core";


/**
 * Indexes code files in a project to understand structure
 */
export function codeIndex(): Tool {
    return new Tool(
        {
            name: "index",
            description:
                "Index code files to understand project structure, classes, functions, exports, and their documentation blocks.",
            parameters: {
                directory: {
                    type: "string",
                    description:
                        "The directory to index (default: 'src' if it exists, otherwise current directory)",
                },
                extensions: {
                    type: "array",
                    items: { type: "string" },
                    description:
                        "File extensions to index (default: ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h'])",
                },
            },
        },
        async (args: Record<string, any>) => {
            const { directory, extensions } = args as {
                directory?: string;
                extensions?: string[];
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

                const extensionList = extensions || [
                    ".ts",
                    ".js",
                    ".tsx",
                    ".jsx",
                    ".py",
                    ".java",
                    ".cpp",
                    ".c",
                    ".h",
                ];

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
                        maxDepth: 10, // Limit recursion depth
                    });
                    allFilesRelative.push(...files);
                }

                const allFiles =
                    dir === "."
                        ? allFilesRelative
                        : allFilesRelative.map((file) => path.join(dir, file));

                // Additional safety: limit total files processed
                if (allFiles.length > 5000) {
                    return `Error indexing code: Too many files found (${allFiles.length}). Consider specifying a more specific directory or adding more exclusions.`;
                }

                const result: any = {
                    totalFiles: allFiles.length,
                    files: [],
                    structure: {},
                };

                // Build directory structure with safety limits
                for (const file of allFiles) {
                    const parts = file.split(path.sep);

                    // Skip files with too deep nesting to prevent stack overflow
                    if (parts.length > 20) {
                        continue;
                    }

                    let current = result.structure;
                    let depth = 0;

                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];

                        // Prevent infinite recursion
                        if (depth > 15) {
                            break;
                        }

                        // Skip empty parts or problematic characters
                        if (!part || part === "." || part === ".." || part.length > 255) {
                            continue;
                        }

                        if (!current[part]) {
                            current[part] = {};
                        } else if (typeof current[part] === "string") {
                            // Handle conflict: convert string to object if needed
                            current[part] = {};
                        }

                        // Safety check before traversing
                        if (typeof current[part] !== "object" || current[part] === null) {
                            break;
                        }

                        current = current[part];
                        depth++;
                    }

                    const fileName = parts[parts.length - 1];
                    // Only set if current is an object and fileName is valid
                    if (
                        typeof current === "object" &&
                        current !== null &&
                        fileName &&
                        fileName.length <= 255
                    ) {
                        if (!current[fileName] || typeof current[fileName] === "string") {
                            current[fileName] = "file";
                        }
                    }
                }

                // Basic symbol extraction for TypeScript/JavaScript files
                let processedFiles = 0;
                for (const file of allFiles) {
                    const fileData: any = {
                        path: file,
                        symbols: {
                            classes: [],
                            functions: [],
                            exports: [],
                            imports: [],
                        },
                    };

                    if ([".ts", ".js", ".tsx", ".jsx"].includes(path.extname(file))) {
                        try {
                            // Skip very large files to prevent memory issues
                            const stats = await fs.stat(file);
                            if (stats.size > 10 * 1024 * 1024) {
                                // Skip files larger than 10MB
                                continue;
                            }

                            const content = await fs.readFile(file, "utf-8");

                            // Skip files with too many lines to prevent processing issues
                            const lines = content.split("\n");
                            if (lines.length > 50000) {
                                // Skip files with more than 50k lines
                                continue;
                            }

                            processedFiles++;
                            // Limit the number of files processed for symbol extraction
                            if (processedFiles > 1000) {
                                break;
                            }

                            // Helper function to extract documentation block before a line
                            const extractDocBlock = (lineIndex: number): string | null => {
                                let docLines: string[] = [];
                                let currentIndex = lineIndex - 1;

                                // Skip empty lines
                                while (
                                    currentIndex >= 0 &&
                                    lines[currentIndex]?.trim() === ""
                                    ) {
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
                                while (
                                    currentIndex >= 0 &&
                                    lines[currentIndex]?.trim() === ""
                                    ) {
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

                            // Extract classes with documentation
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i]!;
                                const classMatch = line.match(
                                    /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/,
                                );
                                if (classMatch) {
                                    const className = classMatch[1];
                                    const docBlock = extractDocBlock(i);
                                    const classData: any = {
                                        name: className,
                                        line: i + 1,
                                    };
                                    if (docBlock) {
                                        classData.documentation = docBlock;
                                    }
                                    fileData.symbols.classes.push(classData);
                                }
                            }

                            // Extract functions with documentation
                            for (let i = 0; i < lines.length; i++) {
                                const line = lines[i]!;

                                // Match function declarations
                                const functionMatch = line.match(
                                    /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
                                );
                                if (functionMatch) {
                                    const funcName = functionMatch[1];
                                    const docBlock = extractDocBlock(i);
                                    const funcData: any = {
                                        name: funcName,
                                        line: i + 1,
                                    };
                                    if (docBlock) {
                                        funcData.documentation = docBlock;
                                    }
                                    fileData.symbols.functions.push(funcData);
                                    continue;
                                }

                                // Match const/let/var function assignments
                                const constMatch = line.match(
                                    /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function\b/,
                                );
                                if (constMatch) {
                                    const funcName = constMatch[1];
                                    const docBlock = extractDocBlock(i);
                                    const funcData: any = {
                                        name: funcName,
                                        line: i + 1,
                                    };
                                    if (docBlock) {
                                        funcData.documentation = docBlock;
                                    }
                                    fileData.symbols.functions.push(funcData);
                                    continue;
                                }

                                // Match arrow functions
                                const arrowMatch = line.match(
                                    /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>/,
                                );
                                if (arrowMatch) {
                                    const funcName = arrowMatch[1];
                                    const docBlock = extractDocBlock(i);
                                    const funcData: any = {
                                        name: funcName,
                                        line: i + 1,
                                    };
                                    if (docBlock) {
                                        funcData.documentation = docBlock;
                                    }
                                    fileData.symbols.functions.push(funcData);
                                    continue;
                                }

                                // Match method definitions (name: (...) => ...)
                                const methodMatch = line.match(
                                    /^\s*(\w+)\s*:\s*\([^)]*\)\s*=>/,
                                );
                                if (methodMatch) {
                                    const funcName = methodMatch[1];
                                    const docBlock = extractDocBlock(i);
                                    const funcData: any = {
                                        name: funcName,
                                        line: i + 1,
                                    };
                                    if (docBlock) {
                                        funcData.documentation = docBlock;
                                    }
                                    fileData.symbols.functions.push(funcData);
                                }
                            }

                            // Extract exports
                            const exportMatches = content.match(
                                /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)|export\s*\{([^}]+)\}/g,
                            );
                            if (exportMatches) {
                                for (const match of exportMatches) {
                                    if (match && match.includes("{")) {
                                        // @ts-ignore
                                        const exports = match
                                            .match(/\{([^}]+)\}/)?.[1]
                                            .split(",")
                                            .map((e) => e.trim().split(/\s+as\s+/)[0]); // Handle "export { foo as bar }"
                                        if (exports) {
                                            for (const exp of exports) {
                                                fileData.symbols.exports.push(exp);
                                            }
                                        }
                                    } else {
                                        const exportName = match.match(
                                            /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/,
                                        )?.[1];
                                        if (exportName) {
                                            fileData.symbols.exports.push(exportName);
                                        }
                                    }
                                }
                            }

                            // Extract imports
                            const importMatches = content.match(
                                /import\s+(?:\{[^}]+\}|\w+|\*\s+as\s+\w+)\s+from\s+['"][^'"]+['"]/g,
                            );
                            if (importMatches) {
                                for (const match of importMatches) {
                                    const fromMatch = match.match(/from\s+['"]([^'"]+)['"]/);
                                    if (fromMatch) {
                                        fileData.symbols.imports.push(fromMatch[1]);
                                    }
                                }
                            }
                        } catch (error) {
                            // Skip files that can't be read
                            continue;
                        }
                    }
                    result.files.push(fileData);
                }

                return JSON.stringify(result, null, 2);
            } catch (error: any) {
                return `Error indexing code: ${error.message}`;
            }
        },
    );
}