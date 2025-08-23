import { EventEmitter } from "node:events";
import { Tool } from "./Tool.ts";
import { LLMService } from "./LLMService.ts";
import { Message } from "./Message.ts";
import { ToolCall } from "./ToolCall.ts";
import { d } from "./utils.ts";

export interface AgentConfig {
  llm: LLMService;
  tools?: Tool[];
  systemPrompt?: string;
  history?: Message[];
  temperature?: number;
  maxTokens?: number;
}

export abstract class Agent extends EventEmitter {
  public abstract readonly systemPrompt: string;
  public abstract tools: Tool[];
  public temperature: number = 0.7;
  public maxTokens?: number;
  public history: Message[] = [];

  constructor(public llmService: LLMService) {
    super();
  }

  /**
   * Unified send method with event-driven streaming
   */
  public async send(
    message?: Message,
    streaming: boolean = true,
  ): Promise<Message> {
    const messages = message
      ? await this.processMessage(message, await this.getHistoricalContext())
      : await this.getHistoricalContext();

    const streamablePromise = this.llmService.send({
      messages: this.processMessages(messages),
      tools: this.tools,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      streaming: streaming,
    } as any);

    // Set up event listeners for streaming
    streamablePromise.on("chunk", (chunk: string) => {
      this.emit("chunk", chunk);
    });

    streamablePromise.on("toolCall", (toolCall: ToolCall) => {
      this.emit("toolCall", toolCall);
    });

    streamablePromise.on("error", (error: Error) => {
      this.emit("error", error);
    });

    const reply = await streamablePromise;
    streamablePromise.removeAllListeners();
    try {
      const newReply = (await this.processReply(
        reply,
        streaming,
      )) as Message;

      this.emit("complete", newReply);
      return newReply;
    } catch (error) {
      this.emit("error", error);
      throw error;
    }
  }

  protected async processReply(
    reply: Message,
    streaming = false,
  ): Promise<Message> {
    this.history.push(reply);

    if (reply.toolCalls?.length) {
      for (const toolCall of reply.toolCalls) {
        try {
          const tool = this.tools.find((t) => t.name === toolCall.name);
          console.log(
            `[ ToolCall: ${toolCall.name} ${JSON.stringify(toolCall.args).replace(/\s+/g, " ").substring(0, 60)} ]`,
          );
          if (tool) {
            toolCall.result = await tool.call(toolCall.args);
          } else {
            toolCall.result = `Error: Tool "${toolCall.name}" not found`;
          }
        } catch (e: any) {
          toolCall.result = `Error: "${e.message}"`;
        }

        console.log(toolCall.result.substring(0, 80).replace(/\s+/g, " "));

        this.history.push(toolCall.message);
      }

      const newReply = await this.send(undefined, streaming);
      // the ToolCall and response go in history because the assistant knows what to do with them,
      // but the client is only expecting a reply, so return the messages stitched together.
      // stream will emit as it should because it's the same instance of Agent.
      const mergedMessage = new Message(
        "assistant",
        `${reply.content}\n${newReply.content}`,
      );
      mergedMessage.toolCalls = [
        ...reply.toolCalls,
        ...(newReply.toolCalls ?? []),
      ];

      return mergedMessage;
    }

    return reply;
  }

  protected async getHistoricalContext(): Promise<Message[]> {
    return [new Message("system", this.systemPrompt), ...this.history];
  }

  protected async processMessage(
    message: Message,
    context: Message[],
  ): Promise<Message[]> {
    this.history.push(message);
    context.push(message);

    return context;
  }

  public processMessages(messages: Message[]) {
    return messages;
  }
}
