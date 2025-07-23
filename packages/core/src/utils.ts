/**
 * Debug utility function that prints objects with unlimited depth
 * and returns the input for chaining.
 *
 * @param args - Any number of arguments to debug print
 * @returns The first argument passed in, or undefined if no arguments
 */
export function d<T extends any[]>(...args: T): any {
  console.dir(args.length > 1 ? args : args[0], { depth: null });
  return args.length > 1 ? args : args[0];
}

// ============================================================================
// ASYNC UTILITIES
// ============================================================================

/**
 * Sleep for a specified number of milliseconds
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified time
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// OBJECT UTILITIES
// ============================================================================

/**
 * Deep clone an object using structural cloning
 * Note: This won't work with functions, undefined, symbols, etc.
 * @param obj - Object to clone
 * @returns Deep cloned object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as unknown as T;
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item)) as unknown as T;
  }

  if (typeof obj === "object") {
    const cloned = {} as T;
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Safely get a nested property from an object using dot notation
 * @param obj - Object to get property from
 * @param path - Dot-separated path to the property (e.g., "user.profile.name")
 * @param defaultValue - Value to return if property doesn't exist
 * @returns The property value or default value
 */
export function get(obj: any, path: string, defaultValue?: any): any {
  if (!obj || typeof obj !== "object") {
    return defaultValue;
  }

  const keys = path.split(".");
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined || !(key in current)) {
      return defaultValue;
    }
    current = current[key];
  }

  return current;
}

/**
 * Deep merge multiple objects into a single object
 * Later objects override earlier ones
 * @param objects - Objects to merge
 * @returns Merged object
 */
export function deepMerge<T>(...objects: Partial<T>[]): T {
  const result = {} as T;

  for (const obj of objects) {
    if (!obj || typeof obj !== "object") continue;

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date)
        ) {
          // Recursively merge objects
          (result as any)[key] = deepMerge((result as any)[key] || {}, value);
        } else {
          // Direct assignment for primitives, arrays, dates, etc.
          (result as any)[key] = value;
        }
      }
    }
  }

  return result;
}

// ============================================================================
// TOKEN ESTIMATION
// ============================================================================

/**
 * Rough estimation of token count for text
 * Based on the approximation that 1 token is roughly 4 characters for English text
 * This is a rough estimate and may not be accurate for all models or languages
 * @param text - Text to estimate tokens for
 * @returns Estimated number of tokens
 */
export function estimateTokens(text: string): number {
  if (!text || typeof text !== "string") {
    return 0;
  }

  // Remove extra whitespace and normalize
  const normalizedText = text.trim().replace(/\s+/g, " ");

  // Rough approximation: 1 token is roughly 4 characters for English
  // Add some buffer for punctuation and special tokens
  const charCount = normalizedText.length;
  const roughTokens = Math.ceil(charCount / 4);

  // Add buffer for special tokens, punctuation, etc.
  const bufferMultiplier = 1.2;

  return Math.ceil(roughTokens * bufferMultiplier);
}

// ============================================================================
// STREAM UTILITIES
// ============================================================================

/**
 * Convert a ReadableStream of strings to a single concatenated string
 * @param stream - ReadableStream to convert
 * @returns Promise that resolves to the concatenated string
 */
export async function streamToString(
  stream: ReadableStream<string>,
): Promise<string> {
  const reader = stream.getReader();
  let result = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (typeof value === "string") {
        result += value;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return result;
}
