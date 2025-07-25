import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import * as fs from "fs";
import { DoofyDevAgent } from "./agents/DoofyDevAgent";
import { FreeAgent } from "./agents/FreeAgent";
import { Message, Agent } from "@fraimwork/core";
import { AgentFactory } from "./lib/AgentFactory";
import {createHash} from "crypto";

const conversationHistoryFile = "./conversationHistory.json";

function loadConversationHistory() {
  try {
    const data = fs.readFileSync(conversationHistoryFile, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    return { conversationById: {}, conversationByHash: {} };
  }
}

function saveConversationHistory(
  conversationById: Record<string, any>,
  conversationByHash: Record<string, any>,
) {
  const data = JSON.stringify(
    { conversationById, conversationByHash },
    null,
    2,
  );
  fs.writeFileSync(conversationHistoryFile, data, "utf-8");
}

const { conversationById, conversationByHash } = loadConversationHistory();

/**
 * Server file for the Doofy AI assistant
 * Handles API endpoints for chat completions and model listing
 */
const app = express();
app.use(cors());
app.use(express.json());

// Available agent types
const agentTypes: Record<string, any> = {
  doofy: DoofyDevAgent,
  free: FreeAgent,
};

// OpenAI-compatible API endpoint for chat completions
app.post(
  "/v1/chat/completions",
  async (req: Request, res: Response, next: NextFunction) => {
    console.log("/v1/chat/completions");
    try {
      const {
        model = "doofy",
        messages,
        temperature,
        max_tokens,
        stream = true,
        previous_response_id,
      } = req.body;

      if (!agentTypes[model]) {
        res.status(400).json({
          error: {
            message: `Model '${model}' not found. Available models: ${Object.keys(agentTypes).join(", ")}`,
            type: "invalid_request_error",
            param: "model",
            code: "model_not_found",
          },
        });
        return next();
      }

      const agent: Agent = AgentFactory.getAgent(agentTypes[model]);

      const userMessages = messages.filter(
        (message: any) => message.role == "user",
      );

      if (previous_response_id) {
        agent.history = conversationById[previous_response_id];
        agent.history.push(userMessages.pop());
      } else if (userMessages.length > 1) {
        agent.history =
          conversationByHash[
            hash(userMessages[userMessages.length - 2].content)
          ];
        agent.history.push(messages.pop());
      } else {
        agent.history = messages.map(
          (message: any) => new Message(message.role, message.content),
        );
      }
      const id = `chatcmpl-${Date.now()}`;
      const message = agent.history.pop()!;
      const messageHash = hash(message.content);
      conversationById[id] = agent.history;
      conversationByHash[messageHash] = agent.history;

      // Set agent properties from request
      if (temperature !== undefined) agent.temperature = temperature;
      if (max_tokens !== undefined) agent.maxTokens = max_tokens;

      if (stream) {
        // Set up streaming response in OpenAI format
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        let messageContent = "";

        // Send the initial response
        res.write(
          `data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: agent.modelName,
            choices: [
              {
                index: 0,
                delta: { role: "assistant" },
                finish_reason: null,
              },
            ],
          })}\n\n`,
        );

        // Event-driven streaming
        agent.on("chunk", (chunk: string) => {
          messageContent += chunk;
          res.write(
            `data: ${JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: agent.modelName,
              choices: [
                {
                  index: 0,
                  delta: { content: chunk },
                  finish_reason: null,
                },
              ],
            })}\n\n`,
          );
        });

        agent.on("toolCall", (toolCall: any) => {
          // Handle tool calls in streaming mode
          res.write(
            `data: ${JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: agent.modelName,
              choices: [
                {
                  index: 0,
                  delta: { content: `[ Tool: ${toolCall.name} ]\n` },
                  finish_reason: null,
                },
              ],
            })}\n\n`,
          );
        });

        try {
          await agent.send(message, true);
          res.write(
            `data: ${JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: agent.modelName,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "stop",
                },
              ],
            })}\n\n`,
          );
        } catch (e) {
          console.error("Error:", e);
          res.write(
            `data: ${JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: agent.modelName,
              choices: [
                {
                  index: 0,
                  delta: {},
                  finish_reason: "error",
                },
              ],
            })}\n\n`,
          );
        }
        res.write("data: [DONE]\n\n");
        saveConversationHistory(conversationById, conversationByHash);
        res.end();
      } else {
        // Non-streaming mode
        const response = await agent.send(message, false);
        res.json({
          id: `chatcmpl-${Date.now()}`,
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: agent.modelName,
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: response.content,
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: -1, // We don't track token usage
            completion_tokens: -1,
            total_tokens: -1,
          },
        });
      }
    } catch (error) {
      console.error("Error:", error);
      if (res.headersSent) {
        res.write(
          `data: ${JSON.stringify({
            id: "error",
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: "",
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "error",
              },
            ],
          })}\n\n`,
        );
        saveConversationHistory(conversationById, conversationByHash);
        res.end();
        return next(error);
      }
      res.status(500).json({
        error: {
          message: "An error occurred while processing your request",
          type: "server_error",
          code: "internal_server_error",
        },
      });
    }
  },
);

// OpenAI-compatible API endpoint for listing models
app.get("/v1/models", async (req, res, next) => {
  console.log("/v1/models");
  res.send({
    object: "list",
    data: [
      {
        id: "doofy",
        object: "model",
        created: 1686935002,
        owned_by: "your mom",
      },
      {
        id: "free",
        object: "model",
        created: 1686935002,
        owned_by: "openrouter",
      },
    ],
  });
});

function hash(str: string) {
  return createHash("sha256").update(str).digest("hex");
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
