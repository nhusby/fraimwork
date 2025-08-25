import * as fs from "fs/promises";
import * as path from "path";

/**
 * Strips comments from JSON content
 * @param content - JSON content with potential comments
 * @returns JSON content without comments
 */
function stripJsonComments(content: string): string {
  // Remove single-line comments
  content = content.replace(/\/\/.*$/gm, '');
  // Remove multi-line comments
  content = content.replace(/\/\*[\s\S]*?\*\//g, '');
  return content;
}

/**
 * Finds the nearest tsconfig.json file starting from the given file path
 * @param filePath - The file path to start searching from
 * @returns The path to the nearest tsconfig.json or null if not found
 */
export async function findTsConfig(filePath: string): Promise<string | null> {
  let currentDir = path.dirname(path.resolve(filePath));
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    const tsConfigPath = path.join(currentDir, 'tsconfig.json');
    try {
      await fs.access(tsConfigPath);
      return tsConfigPath;
    } catch {
      // Continue searching in parent directory
    }
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Loads a tsconfig file and merges it with any extended configuration
 * @param tsConfigPath - The path to the tsconfig file
 * @returns The merged tsconfig object
 */
async function loadTsConfig(tsConfigPath: string): Promise<any> {
  const tsConfigContent = await fs.readFile(tsConfigPath, 'utf-8');
  const strippedContent = stripJsonComments(tsConfigContent);
  const tsConfig = JSON.parse(strippedContent);
  
  // If this config extends another, merge it
  if (tsConfig.extends) {
    const extendsPath = path.resolve(path.dirname(tsConfigPath), tsConfig.extends);
    try {
      const extendedConfig = await loadTsConfig(extendsPath);
      
      // Merge the configurations (simplified merge)
      return {
        ...extendedConfig,
        ...tsConfig,
        compilerOptions: {
          ...extendedConfig.compilerOptions,
          ...tsConfig.compilerOptions
        }
      };
    } catch (error) {
      // If we can't load the extended config, just return the original
      return tsConfig;
    }
  }
  
  return tsConfig;
}

/**
 * Resolves an aliased import path using tsconfig.json paths configuration
 * @param importPath - The import path to resolve (e.g., "@/components/Button")
 * @param sourceDir - The directory of the source file containing the import
 * @returns The resolved file path or null if not found
 */
export async function resolvePathAlias(importPath: string, sourceDir: string): Promise<string | null> {
  const tsConfigPath = await findTsConfig(sourceDir);
  if (!tsConfigPath) {
    return null;
  }
  
  try {
    const tsConfig = await loadTsConfig(tsConfigPath);
    
    const compilerOptions = tsConfig.compilerOptions || {};
    const paths = compilerOptions.paths || {};
    const baseUrl = compilerOptions.baseUrl || '.';
    
    // Resolve the base directory for path resolution
    const baseDir = path.resolve(path.dirname(tsConfigPath), baseUrl);
    
    // Try to match the import path with configured path mappings
    for (const [pattern, mappings] of Object.entries(paths)) {
      // Convert pattern to regex (replace * with .* and escape special regex characters)
      const regexPattern = pattern
        .replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') // Escape special regex characters
        .replace(/\\\*/g, '(.*)'); // Replace * with capture group
      
      const regex = new RegExp(`^${regexPattern}$`);
      const match = importPath.match(regex);
      
      if (match) {
        // Use the first mapping for resolution
        const mapping = (mappings as string[])[0];
        if (!mapping) continue;
        
        // Replace * in the mapping with the captured group
        let resolvedPath = mapping;
        if (match.length > 1 && match[1] !== undefined) {
          resolvedPath = mapping.replace(/\*/g, match[1]);
        }
        
        // Resolve the final path
        const fullPath = path.resolve(baseDir, resolvedPath);
        
        // Try to resolve to an actual file
        const resolvedFile = await resolveFilePath(fullPath);
        if (resolvedFile) {
          return resolvedFile;
        }
      }
    }
  } catch (error) {
    // Failed to parse tsconfig or resolve path
    return null;
  }
  
  return null;
}

/**
 * Resolve a file path to an actual file, trying different extensions and index files
 * @param filePath - The file path to resolve
 * @returns The resolved file path or null if not found
 */
async function resolveFilePath(filePath: string): Promise<string | null> {
  // Check if it's a directory import (no extension)
  if (!path.extname(filePath)) {
    // Try common extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const withExt = filePath + ext;
      try {
        await fs.access(withExt);
        return withExt;
      } catch {
        // Continue trying
      }
      
      // Try with /index.ext
      const indexPath = path.join(filePath, 'index' + ext);
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
      await fs.access(filePath);
      return filePath;
    } catch {
      // File doesn't exist
    }
  }
  
  return null;
}