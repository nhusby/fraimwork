import { EventEmitter } from "node:events";
import OpenAI, { ClientOptions } from "openai";
import type {
  ChatCompletionCreateParamsStreaming,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources";
import {
  estimateTokens,
  LLMService,
  Message,
  StreamablePromise,
  Tool,
  ToolCall,
} from "@fraimwork/core";

export class OpenAIService extends LLMService {
  protected client: OpenAI;

  constructor(config: ClientOptions & { model: string; provider?: any; parseToolCalls?: boolean }) {
    super(config.model, config.parseToolCalls || false);
    this.client = new OpenAI(config);
  }

  _send(params: {
    messages: Message[];
    tools: Tool[];
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  }): StreamablePromise<Message> {
    const sendParams = {
      ...params,
      model: this.model,
      messages: convertMessagesToOpenApi(params.messages),
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

    const context = sendParams.messages
      .map((message) => message.content)
      .join("\n");
    console.log("context tokens: ", estimateTokens(context));

    const streamablePromise = new StreamablePromise<Message>(
      (resolve, reject) => {
        if (sendParams.streaming) {
          this.handleStreamingRequest(sendParams, resolve, reject).catch(reject);
        } else {
          this.handleNonStreamingRequest(sendParams, resolve, reject).catch(reject);
        }
      },
    );

    return streamablePromise;
  }

  private async handleNonStreamingRequest(
    params: any,
    resolve: (value: Message) => void,
    reject: (reason?: any) => void,
  ) {
    const response = await this.client.chat.completions.create(
      params as any as ChatCompletionCreateParamsNonStreaming,
    );

    if ("error" in response) {
      throw new Error(`Upstream error: ${(response.error as any).message}`);
    }
    const message = new Message(
      "assistant",
      ("reasoning" in response.choices[0]!.message &&
      response.choices[0]!.message.reasoning
        ? `\n<think>\n${response.choices[0]!.message.reasoning}\n</think>\n`
        : "") + response.choices[0]?.message?.content || "",
    );

    if (this.parseToolCalls) {
      resolve(this.processMessageToolCalls(message, this.parseToolCalls));
    } else if (response.choices[0]?.message?.tool_calls) {
      try {
        message.toolCalls = response.choices[0].message.tool_calls?.map(
          (toolCall) =>
            new ToolCall(
              toolCall.id,
              toolCall.function.name,
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
  }

  private async handleStreamingRequest(
    params: any,
    resolve: (value: Message) => void,
    reject: (reason?: any) => void,
  ): Promise<void> {

    const stream = (await this.client.chat.completions.create(
      params as any as ChatCompletionCreateParamsStreaming,
    )) as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>;

    const emitter = new EventEmitter();
    const toolCalls: (ToolCall & { tempArgs?: string })[] = [];
    let accumulatedContent = "";

    const parsedEmitter = this.handleStreamingWithToolParsing(
      emitter,
    );

    parsedEmitter.on("complete", (message) => {
      resolve(message);
    });

    for await (const chunk of stream) {
      if (!this.parseToolCalls && chunk.choices[0]!.delta.tool_calls) {
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

      if (chunk.choices[0]!.delta?.content) {
        const content = chunk.choices[0]!.delta?.content;
        accumulatedContent += content;
        emitter.emit("chunk", content);
      }
    }

    if (!this.parseToolCalls && toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        if (toolCall?.name) {
          try {
            toolCall.args = toolCall.tempArgs
              ? typeof toolCall.tempArgs == "string"
                ? parseToolCallArgs(<string>toolCall.tempArgs)
                : toolCall.tempArgs
              : {};
            emitter.emit("toolCall", toolCall);
          } catch (e) {
            emitter.emit("error", e);
            console.log(toolCall);
          }
        }
      }
    }

    const message = new Message("assistant", accumulatedContent);
    if (!this.parseToolCalls && toolCalls.length > 0) {
      message.toolCalls = toolCalls.filter((tc) => tc?.name);
    }
    emitter.emit("complete", message);
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
        ? message.toolCalls?.map((toolCall) => ({
            type: "function",
            id: toolCall.id,
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.args),
            },
          }))
        : undefined,
    tool_call_id: ("toolCallId" in message ? message.toolCallId : undefined)!,
  }));
}

function parseToolCallArgs(args: string): any {
  try {
    return JSON.parse(args);
  } catch (e) {
    const result: Record<string, string> = {};
    const regex = /<parameter=([^>]+)>(.*?)<\/parameter>/g;
    let match;
    while ((match = regex.exec(args)) !== null) {
      const paramName = match[1]!;
      const paramValue = match[2]!;
      result[paramName] = paramValue;
    }
    if (Object.keys(result).length > 0) {
      return result;
    }
    throw e;
  }
}
