import { EventEmitter } from "node:events";
import { Tool } from "./Tool.ts";
import { LLMService } from "./LLMService.ts";
import { Message } from "./Message.ts";
import { ToolCall } from "./ToolCall.ts";
import { d } from "./utils.ts";

export interface ModelConfig {
  name: string;
  service: LLMService;
  parseToolCalls?: boolean;
  noStreaming?: boolean;
}

export abstract class Agent extends EventEmitter {
  public abstract readonly systemPrompt: string;
  public abstract tools: Tool[];
  public temperature: number = 0.2;
  public maxTokens?: number;

  protected model: ModelConfig;

  constructor(modelConfig: ModelConfig) {
    super();
    this.model = modelConfig;
  }

  protected get llmService(): LLMService {
    return this.model.service;
  }

  public get modelName(): string {
    return this.model.name;
  }

  protected get parseToolCalls(): boolean {
    return this.model.parseToolCalls ?? false;
  }

  protected get noStreaming(): boolean {
    return this.model.noStreaming ?? false;
  }

  public history: Message[] = [];

  /**
   * Unified send method with event-driven streaming
   */
  public async send(
    message?: Message,
    streaming: boolean = true,
  ): Promise<Message> {
    console.log("AGENT.SEND", { streaming });
    const messages = message
      ? await this.processMessage(message, await this.getHistoricalContext())
      : await this.getHistoricalContext();

    const streamablePromise = this.llmService.send({
      model: this.modelName,
      messages: this.processMessages(messages),
      tools: this.tools,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
      parseToolCalls: this.parseToolCalls,
      streaming: streaming && !this.noStreaming,
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
    d({
      role: "agent",
      content: reply.content.replace(/\s+/g, " ").substring(0, 60),
    });
    try {
      const newReply = (await this.processReply(
        reply,
        streaming && !this.noStreaming,
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
        d({ toolCall });
        try {
          const tool = this.tools.find((t) => t.name === toolCall.name);
          if (tool) {
            toolCall.result = await tool.call(toolCall.args);
          } else {
            toolCall.result = `Error: Tool "${toolCall.name}" not found`;
          }
        } catch (e: any) {
          toolCall.result = `Error: "${e.message}"`;
        }

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
