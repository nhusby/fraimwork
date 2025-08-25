import * as fs from "fs/promises";
import * as path from "path";
import * as ts from "typescript";
import { Tool } from "@fraimwork/core";
import { resolvePathAlias } from "./PathAliasResolver.js";

/**
 * Reads a file and includes relevant context from imported dependencies
 */
export function readFileWithContext(): Tool {
  return new Tool(
    {
      name: "ReadFileWithContext",
      description:
        "Read a file and automatically include relevant context from imported dependencies. " +
        "For JavaScript/TypeScript files, analyzes imports and includes either full file content " +
        "(for extended/implemented classes) or specific symbol definitions with documentation.",
      parameters: {
        filePath: {
          type: "string",
          description: "Path to the file to read with context",
        },
      },
      required: ["filePath"],
    },
    async (args: Record<string, any>) => {
      const { filePath } = args as { filePath: string };
      
      try {
        // Validate file type
        const ext = path.extname(filePath).toLowerCase();
        const validExtensions = ['.js', '.jsx', '.ts', '.tsx'];
        if (!validExtensions.includes(ext)) {
          return `Error: Only JavaScript and TypeScript files are supported. Found: ${ext}`;
        }

        // Resolve full path
        const fullPath = path.resolve(filePath);
        
        // Check if file exists
        try {
          await fs.access(fullPath);
        } catch {
          return `Error: File not found at ${fullPath}`;
        }

        // Read the target file
        const fileContent = await fs.readFile(fullPath, "utf-8");
        const fileDir = path.dirname(fullPath);
        
        // Start building output with the original file
        let output = `> contents of ${filePath}:\n`;
        output += "```" + getLanguageId(ext) + "\n";
        output += fileContent.trim() + "\n";
        output += "```\n\n";
        
        // Parse the source file with TypeScript AST
        const sourceFile = ts.createSourceFile(
          fullPath,
          fileContent,
          ts.ScriptTarget.Latest,
          true
        );
        
        // Start building output with the original file
        output += "```" + getLanguageId(ext) + "\n";
        output += fileContent.trim() + "\n";
        output += "```\n\n";
        
        // Track files we've already processed to avoid duplicates
        const processedFiles = new Set<string>();
        processedFiles.add(fullPath);
        
        // Process each import declaration
        const importPromises: Promise<string | null>[] = [];
        sourceFile.forEachChild(node => {
          if (ts.isImportDeclaration(node)) {
            importPromises.push(
              processImportDeclaration(node, sourceFile, fileDir, fullPath)
                .catch(error => {
                  // Continue with other imports even if one fails
                  return `> Error processing import: ${error.message}\n\n`;
                })
            );
          }
        });
        
        // Process type references that might not be explicit imports
        const typeReferencePromises: Promise<string | null>[] = [];
        
        // Recursively traverse the entire AST to find all nodes
        function traverse(node: ts.Node) {
          typeReferencePromises.push(
            processTypeReferences(node, fileDir, processedFiles)
              .catch(error => {
                // Continue with other type references even if one fails
                return `> Error processing type reference: ${error.message}\n\n`;
              })
          );
          
          // Continue traversing child nodes
          ts.forEachChild(node, traverse);
        }
        
        // Start traversal from the source file
        traverse(sourceFile);
        
        // Wait for all processing to complete
        const importResults = await Promise.all(importPromises);
        const typeReferenceResults = await Promise.all(typeReferencePromises);
        
        // Add results to output
        for (const result of [...importResults, ...typeReferenceResults]) {
          if (result) {
            output += result;
          }
        }
        
        return output.trim();
      } catch (error: any) {
        return `Error reading file with context: ${error.message}`;
      }
    },
  );
}

/**
 * Process an import declaration and extract relevant context
 */
async function processImportDeclaration(
  node: ts.ImportDeclaration,
  sourceFile: ts.SourceFile,
  fileDir: string,
  fullPath: string
): Promise<string | null> {
  const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
  if (!moduleSpecifier || !moduleSpecifier.text) {
    return null;
  }
  
  const importPath = moduleSpecifier.text;
  
  // Resolve the import path to an actual file
  const resolvedPath = await resolveImportPath(importPath, fileDir);
  if (!resolvedPath) {
    return `> Could not resolve import: ${importPath}\n\n`;
  }
  
  // Check if this is a local file import (within the project)
  const isLocalImport = resolvedPath.startsWith(process.cwd());
  if (!isLocalImport) {
    return null; // Skip external packages
  }
  
  // Read the imported file
  const importedContent = await fs.readFile(resolvedPath, "utf-8");
  const importedExt = path.extname(resolvedPath).toLowerCase();
  const importedSourceFile = ts.createSourceFile(
    resolvedPath,
    importedContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  // Check if the file extends or implements any imported classes/interfaces
  if (isExtendedOrImplemented(sourceFile, importedContent, node)) {
    // Include entire file content
    const relativePath = path.relative(process.cwd(), resolvedPath);
    let result = `> contents of ${relativePath}:\n` +
                 "```" + getLanguageId(importedExt) + "\n" +
                 importedContent.trim() + "\n" +
                 "```\n\n";
    
    // Handle re-exports in the imported file
    const reExports = await processReExports(importedContent, resolvedPath);
    if (reExports) {
      result += reExports;
    }
    
    return result;
  } else {
    // For specific symbol imports, extract each symbol with context
    let result = "";
    
    if (node.importClause) {
      // Handle named imports
      if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
        for (const element of node.importClause.namedBindings.elements) {
          const symbolName = element.name.text;
          const symbolWithContext = extractSymbolWithContext(importedContent, symbolName);
          if (symbolWithContext) {
            const relativePath = path.relative(process.cwd(), resolvedPath);
            result += `> partial contents of ${relativePath}:line${symbolWithContext.line}\n`;
            result += "```" + getLanguageId(importedExt) + "\n";
            result += symbolWithContext.content.trim() + "\n";
            result += "```\n\n";
          }
        }
      }
      // Handle default imports
      else if (node.importClause.name) {
        const symbolName = node.importClause.name.text;
        const symbolWithContext = extractSymbolWithContext(importedContent, "default");
        if (symbolWithContext) {
          const relativePath = path.relative(process.cwd(), resolvedPath);
          result += `> partial contents of ${relativePath}:line${symbolWithContext.line}\n`;
          result += "```" + getLanguageId(importedExt) + "\n";
          result += symbolWithContext.content.trim() + "\n";
          result += "```\n\n";
        }
      }
    }
    
    // Handle re-exports in the imported file even for specific symbol imports
    const reExports = await processReExports(importedContent, resolvedPath);
    if (reExports) {
      result += reExports;
    }
    
    return result;
  }
}

/**
 * Process re-export declarations in a file and extract relevant context
 */
async function processReExports(fileContent: string, filePath: string): Promise<string | null> {
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );
  
  let result = "";
  const fileDir = path.dirname(filePath);
  
  // Collect all export declarations to process
  const exportPromises: Promise<string | null>[] = [];
  
  // Traverse the AST to find export declarations
  sourceFile.forEachChild(node => {
    // Handle export * from "..." declarations
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const exportPath = node.moduleSpecifier.text;
      
      // Create a promise for processing this export
      const exportPromise = resolveImportPath(exportPath, fileDir).then(async (resolvedPath) => {
        if (resolvedPath) {
          // Check if this is a local file import (within the project)
          const isLocalImport = resolvedPath.startsWith(process.cwd());
          if (isLocalImport) {
            try {
              // Read and include the re-exported file
              const reExportedContent = await fs.readFile(resolvedPath, "utf-8");
              const reExportedExt = path.extname(resolvedPath).toLowerCase();
              const relativePath = path.relative(process.cwd(), resolvedPath);
              return `> contents of ${relativePath} (re-exported):\n` +
                     "```" + getLanguageId(reExportedExt) + "\n" +
                     reExportedContent.trim() + "\n" +
                     "```\n\n";
            } catch (error) {
              // Ignore errors in re-export processing
              return null;
            }
          }
        }
        return null;
      }).catch(() => {
        // Ignore errors in path resolution
        return null;
      });
      
      exportPromises.push(exportPromise);
    }
  });
  
  // Wait for all export processing to complete
  const exportResults = await Promise.all(exportPromises);
  
  // Combine all results
  for (const exportResult of exportResults) {
    if (exportResult) {
      result += exportResult;
    }
  }
  
  return result || null;
}

/**
 * Check if a file extends or implements any imported classes/interfaces
 */
function isExtendedOrImplemented(
  sourceFile: ts.SourceFile,
  importedContent: string,
  importNode: ts.ImportDeclaration
): boolean {
  let extendsOrImplements = false;
  
  // Check all class and interface declarations in the source file
  sourceFile.forEachChild(node => {
    if (!extendsOrImplements && (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        for (const type of clause.types) {
          const typeName = type.expression.getText(sourceFile);
          
          // Check if this type name is imported from the current import
          if (importNode.importClause && importNode.importClause.namedBindings && 
              ts.isNamedImports(importNode.importClause.namedBindings)) {
            for (const element of importNode.importClause.namedBindings.elements) {
              if (element.name.text === typeName) {
                extendsOrImplements = true;
                return; // Exit the inner loop
              }
            }
          }
        }
      }
    }
  });
  
  return extendsOrImplements;
}

/**
 * Extract a symbol and its preceding documentation from file content
 */
function extractSymbolWithContext(content: string, symbol: string): { content: string; line: number } | null {
  const lines = content.split('\n');
  
  // Handle default export case
  if (symbol === 'default') {
    // Look for "export default" or "export default function" or "export default class"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line && (line.includes('export default') || 
                   line.includes('export default function') || 
                   line.includes('export default class'))) {
        // Extract documentation block before this line
        const docBlock = extractDocumentationBlock(lines, i);
        const symbolContent = extractSymbolDefinition(lines, i);
        
        return {
          content: docBlock ? `${docBlock}\n${symbolContent}` : symbolContent,
          line: i + 1
        };
      }
    }
    return null;
  }
  
  // Look for the symbol definition
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    
    // Check for various symbol definition patterns
    const patterns = [
      new RegExp(`(?:export\\s+)?(?:class|interface|type|enum)\\s+${symbol}\\b`),
      new RegExp(`(?:export\\s+)?(?:function|const|let|var)\\s+${symbol}\\b`),
      new RegExp(`${symbol}\\s*[:=]\\s*(?:function|\\(|\\{|class)`),
    ];
    
    let found = false;
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        found = true;
        break;
      }
    }
    
    if (found) {
      // Extract documentation block before this line
      const docBlock = extractDocumentationBlock(lines, i);
      const symbolContent = extractSymbolDefinition(lines, i);
      
      return {
        content: docBlock ? `${docBlock}\n${symbolContent}` : symbolContent,
        line: i + 1
      };
    }
  }
  
  return null;
}

/**
 * Extract documentation block before a line
 */
function extractDocumentationBlock(lines: string[], lineIndex: number): string | null {
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
}

/**
 * Extract the symbol definition (including any decorators or modifiers)
 */
function extractSymbolDefinition(lines: string[], lineIndex: number): string {
  let resultLines: string[] = [];
  let currentIndex = lineIndex;
  let braceCount = 0;
  let inDefinition = false;
  
  while (currentIndex < lines.length) {
    const line = lines[currentIndex];
    if (line === undefined) break;
    
    resultLines.push(line);
    
    // Check for opening brace
    const openBraces = (line.match(/{/g) || []).length;
    const closeBraces = (line.match(/}/g) || []).length;
    braceCount += openBraces - closeBraces;
    
    // If we found an opening brace and now have balanced braces, we're done
    if (braceCount === 0 && inDefinition && (openBraces > 0 || closeBraces > 0)) {
      break;
    }
    
    // Mark that we're in the definition after the first line
    if (!inDefinition) {
      inDefinition = true;
    }
    
    // If it's a single-line definition (no braces), we're done
    if (!line.includes('{') && !inDefinition && currentIndex > lineIndex) {
      break;
    }
    
    // If it's a single-line definition with braces balanced on the same line
    if (braceCount === 0 && inDefinition && line.includes('{') && line.includes('}')) {
      break;
    }
    
    currentIndex++;
  }
  
  return resultLines.join('\n');
}

/**
 * Resolve an import path to an actual file path
 */
async function resolveImportPath(importPath: string, sourceDir: string): Promise<string | null> {
  // Handle relative imports
  if (importPath.startsWith('.')) {
    // Resolve relative path
    let resolvedPath = path.resolve(sourceDir, importPath);
    
    // Check if it's a directory import (no extension)
    if (!path.extname(resolvedPath)) {
      // Try common extensions
      const extensions = ['.ts', '.tsx', '.js', '.jsx'];
      for (const ext of extensions) {
        const withExt = resolvedPath + ext;
        try {
          await fs.access(withExt);
          return withExt;
        } catch {
          // Continue trying
        }
        
        // Try with /index.ext
        const indexPath = path.join(resolvedPath, 'index' + ext);
        try {
          await fs.access(indexPath);
          return indexPath;
        } catch {
          // Continue trying
        }
      }
    } else {
      // Check if file exists as-is
      try {
        await fs.access(resolvedPath);
        return resolvedPath;
      } catch {
        // File doesn't exist
      }
    }
    
    return null;
  }
  
  // Handle path aliases (e.g., @/*, ~/*)
  const resolvedAliasPath = await resolvePathAlias(importPath, sourceDir);
  if (resolvedAliasPath) {
    return resolvedAliasPath;
  }
  
  // Skip external packages
  return null;
}

/**
 * Process type references that might not be explicit imports
 */
async function processTypeReferences(
  node: ts.Node,
  fileDir: string,
  processedFiles: Set<string>
): Promise<string | null> {
  // Look for variable declarations that might have type references
  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      // Check if this is a variable assignment from a method that returns a specific type
      if (declaration.initializer && ts.isCallExpression(declaration.initializer)) {
        // Check if this is a call that might return StreamablePromise
        const result = await processMethodCallTypeReference(declaration.initializer, fileDir, processedFiles);
        if (result) {
          return result;
        }
      }
    }
  }
  
  // Also directly process variable declarations (not wrapped in statements)
  if (ts.isVariableDeclaration(node)) {
    // Check if this is a variable assignment from a method that returns a specific type
    if (node.initializer && ts.isCallExpression(node.initializer)) {
      // Check if this is a call that might return StreamablePromise
      const result = await processMethodCallTypeReference(node.initializer, fileDir, processedFiles);
      if (result) {
        return result;
      }
    }
  }
  
  return null;
}

/**
 * Process method calls that might return specific types
 */
async function processMethodCallTypeReference(
  callExpression: ts.CallExpression,
  fileDir: string,
  processedFiles: Set<string>
): Promise<string | null> {
  // Check if this is a property access expression (e.g., this.llmService.send)
  if (ts.isPropertyAccessExpression(callExpression.expression)) {
    const propertyAccess = callExpression.expression;
    
    // Check if this is calling a method named "send"
    if (propertyAccess.name.text === "send") {
      // Try to resolve the return type of this method
      // For now, we'll look for StreamablePromise specifically
      const streamablePromisePath = await resolveImportPath("./StreamablePromise", fileDir);
      if (streamablePromisePath && !processedFiles.has(streamablePromisePath)) {
        processedFiles.add(streamablePromisePath);
        const streamableContent = await fs.readFile(streamablePromisePath, "utf-8");
        const streamableExt = path.extname(streamablePromisePath).toLowerCase();
        const relativePath = path.relative(process.cwd(), streamablePromisePath);
        return `> contents of ${relativePath}:\n` +
               "```" + getLanguageId(streamableExt) + "\n" +
               streamableContent.trim() + "\n" +
               "```\n\n";
      }
    }
  }
  
  return null;
}

/**
 * Get language identifier for code blocks based on file extension
 */
function getLanguageId(ext: string): string {
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
      return 'javascript';
    default:
      return 'typescript'; // Default to TypeScript for JS/TS files
  }
}