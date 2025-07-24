import { EventEmitter } from "node:events";
import OpenAI, { ClientOptions } from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources";
import {
  d,
  estimateTokens,
  LLMService,
  Message,
  StreamablePromise,
  Tool,
  ToolCall,
} from "@fraimwork/core";

export class OpenAIService extends LLMService {
  protected client: OpenAI;

  constructor(config: ClientOptions & { provider?: any }) {
    super();
    this.client = new OpenAI(config);
  }

  _send(params: {
    model: string;
    messages: Message[];
    tools: Tool[];
    temperature?: number;
    maxTokens?: number;
    parseToolCalls?: boolean;
    streaming?: boolean;
  }): StreamablePromise<Message> {
    params = {
      ...params,
      // @ts-ignore
      messages: convertMessagesToOpenApi(params.messages),
      // @ts-ignore
      tools: params.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters as any,
        },
      })),
      stream: params.streaming,
    };

    d(
      params.messages.slice(-3).map((message) => ({
        role: message.role,
        content: String(message.content).replace(/\s+/g, " ").substring(0, 60),
      })),
    );

    const context = params.messages
      .map((message) => message.content)
      .join("\n");
    console.log("context tokens: ", estimateTokens(context));

    const streamablePromise = new StreamablePromise<Message>(
      (resolve, reject) => {
        if (params.streaming) {
          // Streaming mode - handle async
          this.handleStreamingRequest(params)
            .then((emitter) => {
              // Forward events from the internal emitter to the StreamablePromise
              emitter.on("chunk", (chunk) =>
                streamablePromise.emit("chunk", chunk),
              );
              emitter.on("toolCall", (toolCall) =>
                streamablePromise.emit("toolCall", toolCall),
              );
              emitter.on("error", (error: any) => {
                streamablePromise.emit("error", error);
                reject(error);
              });
              emitter.on("complete", (message) => {
                streamablePromise.emit("complete", message);
                resolve(message);
              });
            })
            .catch(reject);
        } else {
          // Non-streaming mode
          this.handleNonStreamingRequest(params, resolve, reject);
        }
      },
    );

    return streamablePromise;
  }

  private async handleNonStreamingRequest(
    params: {
      model: string;
      messages: Message[];
      tools?: Tool[];
      temperature?: number;
      maxTokens?: number;
      parseToolCalls?: boolean;
    },
    resolve: (value: Message) => void,
    reject: (reason?: any) => void,
  ) {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model,
        // @ts-ignore
        messages: convertMessagesToOpenApi(params.messages),
        // @ts-ignore
        tools: params.parseToolCalls
          ? undefined
          : params.tools?.map((tool) => ({
              type: "function" as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters as any,
              },
            })),
        temperature: params.temperature,
        max_completion_tokens: params.maxTokens,
      });

      const message = new Message(
        "assistant",
        ("reasoning" in response.choices[0]!.message &&
        response.choices[0]!.message.reasoning
          ? `\n<think>\n${response.choices[0]!.message.reasoning}\n</think>\n`
          : "") + response.choices[0]?.message?.content || "",
      );

      if (params.parseToolCalls) {
        // Use base class tool parsing for manual parsing
        resolve(this.processMessageToolCalls(message, params.parseToolCalls));
      } else if (response.choices[0]?.message?.tool_calls) {
        // Use native OpenAI tool calls
        try {
          message.toolCalls = response.choices[0].message.tool_calls?.map(
            (toolCall) =>
              new ToolCall(
                toolCall.id,
                toolCall.function.name,
                // TODO: this is duplication
                toolCall.function.arguments
                  ? JSON.parse(toolCall.function.arguments)
                  : undefined,
              ),
          );
        } catch (e: any) {
          console.error(e.stack);
        }
        resolve(message);
      } else {
        resolve(message);
      }
    } catch (error) {
      reject(error);
    }
  }

  private async handleStreamingRequest(params: {
    model: string;
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    parseToolCalls?: boolean;
  }): Promise<EventEmitter> {
    const { parseToolCalls } = params;

    const stream = (await this.client.chat.completions.create(
      params as any as ChatCompletionCreateParamsStreaming,
    )) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    // Create a source emitter for the raw stream
    const emitter = new EventEmitter();

    let thinking = false;
    const toolCalls: (ToolCall & { tempArgs?: string })[] = [];
    let accumulatedContent = "";

    // Use base class parsing to handle tool parsing if needed
    const parsedEmitter = this.handleStreamingWithToolParsing(
      emitter,
      parseToolCalls || false,
    );

    try {
      (async () => {
        for await (const chunk of stream) {
          // Handle native tool calls (when parseToolCalls=false)
          if (!parseToolCalls && chunk.choices[0]!.delta.tool_calls) {
            for (const toolCall of chunk.choices[0]!.delta.tool_calls) {
              if (!toolCalls[toolCall.index]) {
                toolCalls[toolCall.index] = new ToolCall(String(toolCall.id));
                toolCalls[toolCall.index]!.tempArgs = "";
              }
              if (toolCall.function?.name) {
                toolCalls[toolCall.index]!.name += toolCall.function.name;
              }
              if (toolCall.function?.arguments) {
                toolCalls[toolCall.index]!.tempArgs +=
                  toolCall.function.arguments;
              }
            }
          }

          // Handle content chunks
          if (chunk.choices[0]!.delta?.content) {
            const content = chunk.choices[0]!.delta?.content;
            accumulatedContent += content;
            emitter.emit("chunk", content);
          }

          // Handle reasoning/thinking
          if (
            "reasoning" in chunk.choices[0]!.delta &&
            chunk.choices[0]!.delta.reasoning
          ) {
            const reasoning = chunk.choices[0]!.delta.reasoning;
            if (!thinking) {
              thinking = true;
              emitter.emit("chunk", "\n<think>\n");
            }
            emitter.emit("chunk", reasoning);
          } else {
            if (thinking) {
              thinking = false;
              emitter.emit("chunk", "\n</think>\n");
            }
          }
        }

        // Process any completed native tool calls
        if (!parseToolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            if (toolCall?.name) {
              try {
                toolCall.args = toolCall.tempArgs
                  ? // TODO: should this be parsed here?
                    typeof toolCall.tempArgs == "string"
                    ? JSON.parse(<string>toolCall.tempArgs)
                    : toolCall.tempArgs
                  : {};
                emitter.emit("toolCall", toolCall);
              } catch (e) {
                console.error("Error parsing tool call:", e);
                emitter.emit("error", e);
              }
            }
          }
        }

        const message = new Message("assistant", accumulatedContent);
        if (!parseToolCalls && toolCalls.length > 0) {
          message.toolCalls = toolCalls.filter((tc) => tc?.name);
        }
        emitter.emit("complete", message);
      })().then();
    } catch (error) {
      emitter.emit("error", error);
    }

    return parsedEmitter;
  }
}

export function convertMessagesToOpenApi(
  messages: Message[],
): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((message: Message) => ({
    role: message.role as any,
    content: message.content,
    tool_calls:
      "toolCalls" in message
        ? message.toolCalls?.map((toolCall) => {
            return {
              type: "function",
              id: toolCall.id,
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.args),
              },
            };
          })
        : undefined,
    tool_call_id: ("toolCallId" in message ? message.toolCallId : undefined)!,
  }));
}
