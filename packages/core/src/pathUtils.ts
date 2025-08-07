import * as path from "path";
import * as fs from "fs/promises";

/**
 * Validates that a given path is within the working directory
 * @param filePath - The path to validate
 * @param workingDir - The working directory (defaults to process.cwd())
 * @returns Promise that resolves to the absolute path if valid, rejects if outside working directory
 */
export async function validatePath(
  filePath: string,
  workingDir: string = process.cwd(),
): Promise<string> {
  // Resolve the file path to an absolute path
  const absolutePath = path.resolve(filePath);

  // Resolve the working directory to an absolute path
  const absoluteWorkingDir = path.resolve(workingDir);

  // Check if the file path is within the working directory
  if (!absolutePath.startsWith(absoluteWorkingDir)) {
    throw new Error(`Path "${filePath}" is outside the working directory`);
  }

  return absolutePath;
}

/**
 * Validates multiple paths are within the working directory
 * @param filePaths - Array of paths to validate
 * @param workingDir - The working directory (defaults to process.cwd())
 * @returns Promise that resolves to array of absolute paths if all valid
 */
export async function validatePaths(
  filePaths: string[],
  workingDir: string = process.cwd(),
): Promise<string[]> {
  return Promise.all(
    filePaths.map((filePath) => validatePath(filePath, workingDir)),
  );
}
