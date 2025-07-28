import { Tool, Agent, Message, ModelConfig } from "@fraimwork/core";
import { AgentFactory } from "../lib/AgentFactory.ts";

export function askAgent(
  agentClass: typeof Agent,
  name: string,
  description?: string,
): Tool {
  const toolDescription = description || `Ask ${name} a question`;

  return new Tool(
    {
      name,
      description: toolDescription,
      parameters: {
        request: {
          type: "string",
          description: "your request in plain words",
        },
      },
      required: ["question"],
    },
    async (args: Record<string, any>): Promise<string> => {
      try {
        const agent: Agent = AgentFactory.getAgent(agentClass as any);
        if (!args.request) {
          return "Error: No input";
        }
        const userMessage = new Message("user", args.request);
        const response = await agent.send(userMessage, false);
        if (response && response.content) {
          return response.content;
        }

        return "No response received.";
      } catch (error) {
        return `Error asking ${name}: ${error instanceof Error ? error.stack : String(error)}`;
      }
    },
  );
}
