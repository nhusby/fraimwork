// Individual tool exports
export { analyzeDependencies } from "./AnalyzeDependencies.ts";
export { codeIndex } from "./CodeIndex.ts";
export { codeIndexLite } from "./CodeIndexLite.ts";
export { findSymbol } from "./FindSymbol.ts";
export { readFileWithContext } from "./ReadFileWithContext.ts";
export { typeCheck } from "./TypeCheck.ts";

// Import all tools for array export
import { analyzeDependencies } from "./AnalyzeDependencies.ts";
import { codeIndex } from "./CodeIndex.ts";
import { codeIndexLite } from "./CodeIndexLite.ts";
import { findSymbol } from "./FindSymbol.ts";
import { readFileWithContext } from "./ReadFileWithContext.ts";
import { typeCheck } from "./TypeCheck.ts";

// Array of all tools
export const all = [
  analyzeDependencies,
  codeIndex,
  codeIndexLite,
  findSymbol,
  readFileWithContext,
  typeCheck,
];
