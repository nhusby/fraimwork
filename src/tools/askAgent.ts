import { Tool, Message, Agent } from "@fraimwork/core";
import { createDoofyDevAgent } from "../agents/DoofyDevAgent.js";
import { OpenAIService } from "@fraimwork/openai";

export function askDoofy(): Tool {
  return new Tool(
    {
      name: "askDoofy",
      description: "Ask the DoofyDev agent a question about the codebase.",
      parameters: {
        request: {
          type: "string",
          description: "Your request in plain words to DoofyDev.",
        },
      },
      required: ["request"],
    },
    async (args: Record<string, any>): Promise<string> => {
      try {
        if (!args.request) {
          return "Error: No request provided.";
        }

        // This creates a new, sandboxed agent for the sub-task
        const llmConfig = {
          apiKey: process.env.OPENAI_API_KEY,
          baseURL: process.env.OPENAI_BASE_URL,
          model: process.env.MODEL_NAME ?? "qwen3-coder-30b-a3b-instruct@q5_k_xl",
        };

        if (!llmConfig.apiKey) {
          return "Error: OPENAI_API_KEY is not configured for the sub-agent.";
        }

        const llm = new OpenAIService(llmConfig);
        const agent = createDoofyDevAgent({ llm });

        const userMessage = new Message("user", args.request);
        const response = await agent.send(userMessage, false);

        if (response && response.content) {
          return response.content;
        }

        return "No response received.";
      } catch (error) {
        return `Error asking Doofy: ${error instanceof Error ? error.stack : String(error)}`;
      }
    },
  );
}