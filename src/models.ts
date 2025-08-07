import { OpenAIService } from "@fraimwork/openai";
import type { ModelConfig as FrameworkModelConfig } from "@fraimwork/core";
import * as process from "node:process";

export interface ModelConfig {
  name: string;
  slug?: string;
  providers?: string[];
  contextSize?: number;
  capabilities?: string[];
  pricing?: {
    input: number;
    output: number;
    throughput: number; // tokens per second
  };
  category?: "senior" | "mid" | "junior"; // or any categorization you prefer
  apiProvider?: string;
  parseToolCalls?: boolean;
  noStreaming?: boolean;
}

export interface ProviderConfig {
  name: string;
  baseURL: string;
  apiKey?: string;
  options?: Record<string, any>;
}

export const MODELS: Record<string, ModelConfig> = {
  // Sr.Engineer/Architect
  "anthropic/claude-sonnet-4": {
    name: "anthropic/claude-sonnet-4",
    slug: "anthropic/claude-4-sonnet-20250522",
    providers: ["google-vertex", "google-vertex/global", "anthropic"],
    category: "senior",
    pricing: { input: 3.0, output: 15.0, throughput: 65 },
    apiProvider: "openrouter",
  },
  "google/gemini-2.5-pro": {
    name: "google/gemini-2.5-pro",
    slug: "google/gemini-2.5-pro",
    providers: ["google-ai-studio"],
    category: "senior",
    pricing: { input: 1.25, output: 10.0, throughput: 85 },
    apiProvider: "openrouter",
  },
  "moonshotai/kimi-k2:free": {
    name: "moonshotai/kimi-k2",
    slug: "moonshotai/kimi-k2",
    providers: ["chutes/fp8"],
    category: "senior",
    pricing: { input: 0, output: 0, throughput: 70 },
    apiProvider: "openrouter",
  },
  "moonshotai/kimi-k2": {
    name: "moonshotai/kimi-k2",
    slug: "moonshotai/kimi-k2",
    providers: ["chutes/fp8", "targon/fp8", "baseten/fp8"],
    category: "senior",
    pricing: { input: 1.5, output: 4.0, throughput: 40 },
    apiProvider: "openrouter",
  },
  "moonshotai/kimi-k2:moonshot": {
    name: "moonshotai/kimi-k2",
    // providers: [""],
    category: "senior",
    pricing: { input: 0, output: 0, throughput: 40 },
    apiProvider: "moonshot",
  },
  "qwen/qwen3-coder": {
    name: "qwen/qwen3-coder",
    providers: ["baseten/fp8"],
    category: "senior",
    pricing: { input: 0, output: 0, throughput: 35 },
    apiProvider: "openrouter",
  },
  "qwen/qwen3-coder:free": {
    name: "qwen/qwen3-coder:free",
    slug: "qwen/qwen3-coder-480b-a35b-07-25",
    // providers: ["chutes/fp8"],
    category: "senior",
    pricing: { input: 0, output: 0, throughput: 35 },
    apiProvider: "openrouter",
  },

  // Mid-level Engineer
  "google/gemini-2.5-flash": {
    name: "google/gemini-2.5-flash",
    slug: "google/gemini-2.5-flash",
    providers: ["google-ai-studio"],
    category: "mid",
    pricing: { input: 0.3, output: 2.5, throughput: 200 },
    apiProvider: "openrouter",
  },
  "inception/mercury-coder": {
    name: "inception/mercury-coder",
    slug: "inception/mercury-coder-small-beta",
    providers: ["openrouter"],
    category: "mid",
    pricing: { input: 0.25, output: 1.0, throughput: 1250 },
    apiProvider: "openrouter",
    parseToolCalls: true,
    noStreaming: true,
  },
  "qwen/qwen3-235b-a22b": {
    name: "qwen/qwen3-235b-a22b",
    slug: "qwen/qwen3-235b-a22b-04-28",
    category: "mid",
    pricing: { input: 0.2, output: 0.6, throughput: 45 },
    apiProvider: "openrouter",
  },
  "google/gemini-2.5-flash-preview-05-20": {
    name: "google/gemini-2.5-flash-preview-05-20",
    slug: "google/gemini-2.5-flash-lite-preview-06-17",
    providers: ["google-ai-studio"],
    category: "mid",
    pricing: { input: 0.15, output: 0.6, throughput: 80 },
    apiProvider: "openrouter",
  },
  // rate limited
  "google/gemini-2.0-flash-exp:free": {
    name: "google/gemini-2.0-flash-exp:free",
    slug: "google/gemini-2.0-flash-exp",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 165 },
    apiProvider: "openrouter",
  },
  "deepseek/deepseek-r1-0528:free": {
    name: "deepseek/deepseek-r1-0528:free",
    slug: "deepseek/deepseek-r1-0528",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 45 },
    apiProvider: "openrouter",
    providers: ["chutes"],
    parseToolCalls: true,
  },
  "tngtech/deepseek-r1t2-chimera:free": {
    // R1/V3 hybrid
    name: "tngtech/deepseek-r1t2-chimera:free",
    slug: "tngtech/deepseek-r1t2-chimera",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 36 },
    apiProvider: "openrouter",
    providers: ["chutes"],
    parseToolCalls: true,
  },
  "microsoft/mai-ds-r1:free": {
    // microsoft DeepSeek R1 variant (totally tubular bro)
    name: "microsoft/mai-ds-r1:free",
    slug: "microsoft/mai-ds-r1",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 40 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "deepseek/deepseek-chat-v3-0324:free": {
    // ⭐
    name: "deepseek/deepseek-chat-v3-0324:free",
    slug: "deepseek/deepseek-chat-v3-0324",
    providers: ["chutes/fp8"],
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 45 },
    apiProvider: "openrouter",
  },
  // "tencent/hunyuan-a13b-instruct:free": {
  //   // A little Sketchy as DoofyDev, hesitant to use tools
  //   name: "tencent/hunyuan-a13b-instruct:free",
  //   category: "mid",
  //   pricing: { input: 0.0, output: 0.0, throughput: 75 },
  //   apiProvider: "openrouter",
  //   parseToolCalls: true,
  // },
  "qwen/qwen3-235b-a22b-07-25:free": {
    name: "qwen/qwen3-235b-a22b-07-25:free",
    slug: "qwen/qwen3-235b-a22b-07-25",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 90 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "qwen/qwen3-235b-a22b:free": {
    // rate limited 1 rpm
    name: "qwen/qwen3-235b-a22b:free",
    slug: "qwen/qwen3-235b-a22b-04-28",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 40 },
    apiProvider: "openrouter",
  },
  "moonshotai/kimi-dev-72b:free": {
    // funky think tags
    name: "moonshotai/kimi-dev-72b:free",
    slug: "moonshotai/kimi-dev-72b",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 45 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "meta-llama/llama-3.3-70b-instruct:free": {
    // rate limited 1 rpm
    name: "meta-llama/llama-3.3-70b-instruct:free",
    slug: "meta-llama/llama-3.3-70b-instruct",
    category: "mid",
    pricing: { input: 0.0, output: 0.0, throughput: 60 },
    providers: ["together/fp8"],
    apiProvider: "openrouter",
  },

  // Jr. Engineer
  "qwen/qwen3-32b:free": {
    // successfully added comments with EditFile
    name: "qwen/qwen3-32b:free",
    slug: "qwen/qwen3-32b-04-28",
    providers: ["chutes"],
    category: "junior",
    pricing: { input: 0.08, output: 0.29, throughput: 140 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "qwen/qwen3-30b-a3b": {
    // successfully added todos with EditFile
    name: "qwen/qwen3-30b-a3b",
    slug: "qwen/qwen3-30b-a3b-04-28",
    providers: ["parasail/fp8", "deepinfra/fp8"],
    category: "junior",
    pricing: { input: 0.08, output: 0.29, throughput: 100 },
    apiProvider: "openrouter",
  },
  "qwen/qwen3-30b-a3b:free": {
    // successfully added todos with EditFile
    name: "qwen/qwen3-30b-a3b:free",
    slug: "qwen/qwen3-30b-a3b-04-28",
    providers: ["chutes"],
    category: "junior",
    pricing: { input: 0.08, output: 0.29, throughput: 140 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "qwen/qwen3-14b:free": {
    // successfully added todos with EditFile
    name: "qwen/qwen3-30b-a3b:free",
    slug: "qwen/qwen3-14b-04-28",
    providers: ["chutes"],
    category: "junior",
    pricing: { input: 0.08, output: 0.29, throughput: 70 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "qwen3-4b-mlx": {
    name: "qwen3-4b-mlx",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 42 },
    apiProvider: "lmstudio",
  },
  "qwen3-8b-mlx": {
    name: "qwen3-8b-mlx",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 32 },
    apiProvider: "lmstudio",
  },
  "gemma-3n-e4b-it": {
    name: "gemma-3n-e4b-it",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 25 },
    apiProvider: "lmstudio",
  },
  // "mistralai/devstral-small-2505:free" - broken
  "openrouter/horizon-beta": {
    name: "openrouter/horizon-beta",
    slug: "openrouter/horizon-beta",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 120 },
    apiProvider: "openrouter",
  },
  "z-ai/glm-4.5-air:free": {
    name: "z-ai/glm-4.5-air:free",
    slug: "z-ai/glm-4.5-air",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 145 },
    apiProvider: "openrouter",
    parseToolCalls: true,
  },
  "qwen3-coder-30b-a3b-instruct@q4_k_m": {
    name: "qwen3-coder-30b-a3b-instruct@q4_k_m",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 30 },
    apiProvider: "lmstudio-ryzenrig",
    // parseToolCalls: true,
  },
  "qwen3-30b-a3b-128k@q2_k_l": {
    name: "qwen3-30b-a3b-128k@q2_k_l",
    category: "junior",
    pricing: { input: 0.0, output: 0.0, throughput: 30 },
    apiProvider: "lmstudio-ryzenrig",
    parseToolCalls: true,
  },
};

export const ApiProviders: Record<string, ProviderConfig> = {
  openrouter: {
    name: "OpenRouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  },
  moonshot: {
    name: "Moonshot",
    apiKey: process.env.MOONSHOT_API_KEY,
    baseURL: "https://api.moonshot.ai/v1",
  },
  lmstudio: {
    name: "LM Studio",
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
  },
  "lmstudio-ryzenrig": {
    name: "LM Studio",
    baseURL: "http://ryzenrig:1234/v1",
    apiKey: "lm-studio",
  },
  // Add more providers as needed
};

/**
 * Create a framework ModelConfig from a model key
 */
export function createModelConfig(modelKey: string): FrameworkModelConfig {
  const model = MODELS[modelKey];
  if (!model) {
    throw new Error(`Model configuration not found for key: ${modelKey}`);
  }

  // Get the API provider specified in the model config or fallback to openrouter
  const apiProvider = model.apiProvider || "openrouter";
  const provider = ApiProviders[apiProvider];

  if (!provider) {
    throw new Error(`API provider not found: ${apiProvider}`);
  }

  const service = new OpenAIService({
    baseURL: provider.baseURL,
    apiKey: provider.apiKey,
    // @ts-ignore - Add provider information for OpenRouter
    provider: { order: model.providers },
  });

  return {
    name: model.name,
    service,
    parseToolCalls: model.parseToolCalls,
    noStreaming: model.noStreaming,
    // @ts-ignore
    slug: model.slug,
  };
}

/**
 * Create multiple ModelConfigs from model keys
 */
export function createModelConfigs(
  modelKeys: string[],
): FrameworkModelConfig[] {
  return modelKeys.map(createModelConfig);
}
