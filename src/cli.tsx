import { Message, Tool, estimateTokens } from "@fraimwork/core";
import * as readline from "readline";
import { AgentFactory } from "./lib/AgentFactory.js";
import { DoofyDevAgent } from "./agents/DoofyDevAgent.js";
import { MODELS } from "./models.js";

let agent = AgentFactory.getAgent(DoofyDevAgent);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const splashScreen = `
[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m_[38;5;46m_[38;5;46m_[38;5;83m_[38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m_[38;5;83m_[38;5;83m_[38;5;83m_[38;5;83m [38;5;83m [38;5;83m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m        ,__
[38;5;46m [38;5;46m [38;5;46m [38;5;46m/[38;5;46m [38;5;46m_[38;5;83m_[38;5;83m [38;5;83m\\[38;5;83m_[38;5;83m_[38;5;83m_[38;5;120m_[38;5;120m [38;5;120m [38;5;120m_[38;5;120m_[38;5;120m_[38;5;120m_[38;5;120m [38;5;120m [38;5;120m/[38;5;83m [38;5;83m_[38;5;83m_[38;5;83m/[38;5;83m_[38;5;83m [38;5;46m [38;5;46m_[38;5;46m_[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m       /   \`\\
[38;5;46m [38;5;46m [38;5;46m/[38;5;46m [38;5;46m/[38;5;83m [38;5;83m/[38;5;83m [38;5;83m/[38;5;83m [38;5;83m_[38;5;120m_[38;5;120m [38;5;120m\\[38;5;120m/[38;5;120m [38;5;120m_[38;5;120m_[38;5;120m [38;5;120m\\[38;5;120m/[38;5;83m [38;5;83m/[38;5;83m_[38;5;83m/[38;5;83m [38;5;83m/[38;5;46m [38;5;46m/[38;5;46m [38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m      / ,^\\ |
[38;5;46m [38;5;46m/[38;5;46m [38;5;46m/[38;5;83m_[38;5;83m/[38;5;83m [38;5;83m/[38;5;83m [38;5;83m/[38;5;120m_[38;5;120m/[38;5;120m [38;5;120m/[38;5;120m [38;5;120m/[38;5;120m_[38;5;120m/[38;5;120m [38;5;120m/[38;5;83m [38;5;83m_[38;5;83m_[38;5;83m/[38;5;83m [38;5;83m/[38;5;46m_[38;5;46m/[38;5;46m [38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m     / /  / /
[38;5;46m/[38;5;46m_[38;5;46m_[38;5;83m_[38;5;83m_[38;5;83m_[38;5;83m/[38;5;83m\\[38;5;83m_[38;5;120m_[38;5;120m_[38;5;120m_[38;5;120m/[38;5;120m\\[38;5;120m_[38;5;120m_[38;5;120m_[38;5;120m_[38;5;120m/[38;5;83m_[38;5;83m/[38;5;83m [38;5;83m [38;5;83m\\[38;5;83m_[38;5;46m_[38;5;46m,[38;5;46m [38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m    / /  / /
 [38;5;46m [38;5;46m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m/[38;5;120m [38;5;83m_[38;5;83m_[38;5;83m [38;5;83m\\[38;5;83m_[38;5;46m_[38;5;46m_[38;5;46m_[38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m_[38;5;46m_[38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m  / /  / /
 [38;5;46m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m/[38;5;120m [38;5;83m/[38;5;83m [38;5;83m/[38;5;83m [38;5;83m/[38;5;83m [38;5;46m_[38;5;46m [38;5;46m\\[38;5;46m [38;5;46m|[38;5;46m [38;5;46m/[38;5;46m [38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m / /  / /
 [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m/[38;5;120m [38;5;83m/[38;5;83m_[38;5;83m/[38;5;83m [38;5;83m/[38;5;83m [38;5;46m [38;5;46m_[38;5;46m_[38;5;46m/[38;5;46m [38;5;46m|[38;5;46m/[38;5;46m [38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m/    / /
 [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;83m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m [38;5;120m/[38;5;120m_[38;5;83m_[38;5;83m_[38;5;83m_[38;5;83m_[38;5;83m/[38;5;83m\\[38;5;46m_[38;5;46m_[38;5;46m_[38;5;46m/[38;5;46m|[38;5;46m_[38;5;46m_[38;5;46m_[38;5;46m/[38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [38;5;46m [0m\\._,/
 
He's here to help! (But maybe he shouldn't...)

How can Doofy "help" you today?
`;

async function interactiveCLI() {
  console.log(splashScreen);
  console.log(
    "Type 'exit' to quit, 'clear' to clear history, or 'help' for commands\n",
  );

  while (true) {
    try {
      const userInput = await askQuestion("You: ");

      if (userInput.startsWith("/")) {
        await handleCommand(userInput);
        continue;
      }

      if (userInput.trim() === "") continue;

      console.log("\nDoofyDev: ");

      // Event-driven streaming mode
      agent.on("chunk", (chunk: string) => {
        if (
          !chunk.includes("<tool-calls>") &&
          !chunk.includes("</tool-calls>")
        ) {
          process.stdout.write(chunk);
        }
      });

      agent.on("toolCall", (toolCall: any) => {
        process.stdout.write(`[ Tool: ${toolCall.name} ]\n`);
      });

      agent.on("error", (error: Error) => {
        console.error("\nError:", error.message);
      });

      agent.on("complete", () => {
        process.stdout.write("\n");
      });

      await agent.send(new Message("user", userInput), true);

      // Clean up listeners
      agent.removeAllListeners("chunk");
      agent.removeAllListeners("toolCall");
      agent.removeAllListeners("error");
      agent.removeAllListeners("complete");

      console.log("\n");
    } catch (error) {
      console.error("Error:", error);
      console.log("Please try again.\n");
    }
  }

  rl.close();
}

async function handleCommand(userInput: string) {
  const [commandName, ...args] = userInput.slice(1).split(" ");

  switch (commandName.toLowerCase()) {
    case "exit":
      console.log("Goodbye!");
      process.exit(0); // Exit the process
    case "clear":
      (agent as any).history = [];
      console.clear();
      console.log("History cleared!\n");
      return;
    // case "model":
    //   if (args.length === 0) {
    //     // List available models
    //     console.log("\nAvailable Models:");
    //
    //     console.log("\nSr. Engineer/Architect:");
    //     Object.entries(MODELS)
    //       .filter(([_, model]) => model.category === "senior")
    //       .forEach(([key, model]) => {
    //         console.log(
    //           `  ${model.name} - Input: $${model.pricing?.input.toFixed(2)}, Output: $${model.pricing?.output.toFixed(2)}, TPS: ${model.pricing?.throughput}`,
    //         );
    //       });
    //
    //     console.log("\nMid-level Engineer:");
    //     Object.entries(MODELS)
    //       .filter(([_, model]) => model.category === "mid")
    //       .forEach(([key, model]) => {
    //         console.log(
    //           `  ${model.name} - Input: $${model.pricing?.input.toFixed(2)}, Output: $${model.pricing?.output.toFixed(2)}, TPS: ${model.pricing?.throughput}`,
    //         );
    //       });
    //
    //     console.log("\nJr. Engineer:");
    //     Object.entries(MODELS)
    //       .filter(([_, model]) => model.category === "junior")
    //       .forEach(([key, model]) => {
    //         console.log(
    //           `  ${model.name} - Input: $${model.pricing?.input.toFixed(2)}, Output: $${model.pricing?.output.toFixed(2)}, TPS: ${model.pricing?.throughput}`,
    //         );
    //       });
    //
    //     // console.log(`\nCurrent model: ${config.modelKey}`);
    //   } else {
    //     // Set model
    //     const newModelKey = args.join(" ");
    //     if (MODELS[newModelKey]) {
    //       config.modelKey = newModelKey;
    //       config.streaming = newModelKey !== "inception/mercury-coder";
    //       console.log(`Model set to: ${newModelKey}`);
    //       console.log(
    //         `Streaming mode is ${config.streaming ? "enabled" : "disabled"}`,
    //       );
    //
    //       // Recreate the agent with the new model
    //       const newAgent = AgentFactory.getAgent(
    //         DoofyDevAgent,
    //         config.modelKey,
    //       );
    //       if (newAgent) {
    //         // Transfer history if possible
    //         if ((agent as any).history && (newAgent as any).history) {
    //           (newAgent as any).history = (agent as any).history;
    //         }
    //         agent = newAgent;
    //       }
    //     } else {
    //       console.log(`Model not found: ${newModelKey}`);
    //       console.log("Use '/model' to see available models");
    //     }
    //   }
    //   return;
    case "help":
      showHelp();
      return;
  }

  const tool = (agent.tools as Tool[]).find((t) => t.name === commandName);

  if (tool) {
    try {
      const params: Record<string, any> = {};
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--")) {
          const key = arg.slice(2);
          const value = args[i + 1];
          if (value && !value.startsWith("--")) {
            try {
              // Attempt to parse JSON for arrays/objects, otherwise treat as string
              params[key] = JSON.parse(value);
            } catch {
              params[key] = value;
            }
            i++; // Skip the value
          } else {
            params[key] = true; // Handle boolean flags
          }
        }
      }

      // A simple way to handle single argument tools that don't use --key value
      if (
        Object.keys(params).length === 0 &&
        args.length > 0 &&
        tool.parameters
      ) {
        const toolParams = Object.keys(tool.parameters);
        if (toolParams.length === 1) {
          params[toolParams[0]] = args.join(" ");
        }
      }

      console.log(`\nExecuting tool: ${tool.name}`);
      const result = await tool.call(params);
      console.log("Tool Result:\n", result);
      console.log(`\n${estimateTokens(String(result))} tokens`);
      console.log("");
    } catch (error) {
      console.error(`Error executing tool ${tool.name}:`, error);
    }
  } else {
    console.log(`Unknown command: ${commandName}`);
    console.log("Type '/help' to see available commands.");
  }
}

function askQuestion(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function showHelp() {
  console.log(`
Available Commands:
  help     - Show this help message
  clear    - Clear conversation history
  model    - List available models or change model (e.g., /model or /model google/gemini-2.5-pro)
  exit     - Exit the CLI

Slash Commands (Tools):`);

  const tools = agent.tools as Tool[];
  tools.forEach((tool) => {
    const params = tool.parameters
      ? Object.keys(tool.parameters)
          .map((p) => `--${p} <value>`)
          .join(" ")
      : "";
    console.log(`  /${tool.name} ${params}`);
    console.log(`    - ${tool.description}`);
  });

  console.log(`
DoofyDev can help you with:
  • File operations (read, write, create, delete files)
  • Code analysis (find symbols, analyze dependencies)
  • Project structure exploration
  • Code search and navigation
  • Development tasks and questions

Example prompts:
  "Show me the structure of this project"
  "Find all TypeScript files in the src directory"
  "Read the contents of package.json"
  "Create a new utility function for string manipulation"
  "Where is the Agent class defined?"

`);
}

async function main() {
  await interactiveCLI();
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
