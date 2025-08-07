import { Message } from "./Message.ts";
import { Tool } from "./Tool.ts";
import { ToolCall } from "./ToolCall.ts";
import { StreamablePromise } from "./StreamablePromise.ts";
import { EventEmitter } from "node:events";

/**
 * Interface for LLM service providers (OpenAI, Anthropic, ollama, etc.)
 */
export abstract class LLMService {
  /**
   * Send a message to the LLM and get a streamable promise
   * Can be awaited for final result or listened to for streaming events
   */
  public send(params: {
    model: string;
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    parseToolCalls?: boolean;
    streaming?: boolean;
  }): StreamablePromise<Message> {
    // insert tool instructions and translate historical tool calls
    const processedParams = { ...params };
    if (params.parseToolCalls && params.tools) {
      processedParams.messages = [
        this.generateToolsSystemMessage(params.tools),
        ...params.messages,
      ];
      delete processedParams.tools;
    }

    // Delegate to the concrete implementation
    return this._send(processedParams);
  }

  protected abstract _send(params: {
    model: string;
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    parseToolCalls?: boolean;
    streaming?: boolean;
  }): StreamablePromise<Message>;

  /**
   * Process streaming response with tool parsing when parseToolCalls is enabled
   */
  protected handleStreamingWithToolParsing(
    sourceEmitter: EventEmitter,
    parseToolCalls: boolean,
  ): EventEmitter {
    if (!parseToolCalls) {
      return sourceEmitter;
    }

    const resultEmitter = new EventEmitter();
    let toolBuffer = "";
    let fullContent = "";
    sourceEmitter.on("chunk", (chunk: string) => {
      fullContent += chunk;

      if (toolBuffer || chunk.match(/\s*</)) {
        toolBuffer += chunk;

        if (
          !toolBuffer.match(
            /^\s*(<T?o?o?$|<Tool_?$|<Tool_?Ca?l?l?$|<Tool_?Call>)/i,
          )
        ) {
          // Not a tool call, emit as regular content
          resultEmitter.emit("chunk", toolBuffer);
          toolBuffer = "";
        } else {
          // Check if we have a complete tool call to skip
          if (toolBuffer.match(/<Tool_?Call>.*?<\/Tool_?Call>/is)) {
            // Complete tool call found, skip it (don't emit)
            toolBuffer = "";
          }
          // Otherwise keep buffering until we know what it is
        }
      } else {
        // Regular content, emit immediately
        resultEmitter.emit("chunk", chunk);
      }
    });

    sourceEmitter.on("error", (error) => {
      resultEmitter.emit("error", error);
    });

    sourceEmitter.on("complete", (message: Message) => {
      // Process any remaining tool buffer as regular content if it's not a tool call
      if (toolBuffer && !toolBuffer.match(/<Tool_?Call>/i)) {
        resultEmitter.emit("chunk", toolBuffer);
      }

      this.processMessageToolCalls(message, parseToolCalls);

      // Emit any found tool calls
      if (message.toolCalls?.length) {
        for (const toolCall of message.toolCalls) {
          resultEmitter.emit("toolCall", toolCall);
        }
      }

      resultEmitter.emit("complete", message);
    });

    return resultEmitter;
  }

  /**
   * Generates a system message explaining the available tools and how to invoke them
   */
  protected generateToolsSystemMessage(tools: Tool[]) {
    let message = "You have access to the following tools:\n\n";

    for (const tool of tools) {
      message += `Tool: ${tool.name}\n`;
      if (tool.description) {
        message += `Description: ${tool.description}\n`;
      }

      if (tool.parameters) {
        message += "Parameters:\n";
        const properties = tool.parameters.properties as Record<string, any>;
        const required = (tool.parameters.required as string[]) || [];

        for (const [paramName, paramSchema] of Object.entries(properties)) {
          const isRequired = required.includes(paramName) ? " (required)" : "";
          message += `- ${paramName}${isRequired}: ${paramSchema.type}`;
          if (paramSchema.description) {
            message += ` - ${paramSchema.description}`;
          }
          message += "\n";
        }
      }

      message += "\n";
    }

    message += `To use a tool, respond with the following format:

<ToolCall>
{"tool": "ToolName", "parameters": {"param1": "value1", "param2": "value2"}}
</ToolCall>

CRITICAL: Always use valid JSON format for tool calls. Make sure to match brackets! each "{" must have a matching "}"
`;

    return new Message("system", message);
  }

  protected processMessageToolCalls(message: Message, parseToolCalls: boolean) {
    if (parseToolCalls) {
      message.toolCalls = this.parseToolCallsFromText(message.content);
      message.content = message.content.replace(
        /<Tool_?Call>.*<\/Tool_?Call>/gis,
        "",
      );
    }

    return message;
  }

  /**
   * Parse tool calls from text content using <ToolCall> tags
   */
  protected parseToolCallsFromText(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const jsonMatches = text.matchAll(
      /<Tool_?Call>\s*(\{.*?})\s*<\/Tool_?Call>/gis,
    );
    for (const match of jsonMatches) {
      try {
        const json = JSON.parse(match[1]!); // Use capture group for just the JSON content
        const toolCallsArray = Array.isArray(json) ? json : [json];
        for (const [i, tc] of toolCallsArray.entries()) {
          const name = tc.name ?? tc.tool;
          const args = tc.parameters ?? tc.args ?? tc.arguments;
          const toolCall = new ToolCall(
            tc.id ?? `${name}-${i}-${Date.now()}`,
            name,
            typeof args === "string" ? JSON.parse(args) : args,
          );
          toolCalls.push(toolCall);
        }
      } catch (e: any) {
        console.error("Failed to parse tool call (JSON):", e.message);
        console.log("JSON content:", match[1]);
      }
    }

    // Regex for all <tool_call> variants
    const xmlMatches = text.matchAll(
      /<Tool_?Call>\s*(?:<Tool_?Name>)?(.+?)(?:<\/Tool_?Name>)?\s*(<.+>.+<\/.*>)\s*<\/Tool_?Call>/gis,
    );

    for (const match of xmlMatches) {
      try {
        const name = match[1]!;
        const paramsString = match[2]!;
        const params: { [key: string]: any } = {};

        const paramMatches = paramsString.matchAll(
          /<(?:parameter name="|.*key>)(.+)(?:<\/.*key>\s*<.*value>|">)(.+)<\/(?:parameter|.*value)>/gis,
        );
        for (const paramMatch of paramMatches) {
          params[paramMatch[1]!] = paramMatch[2]!;
        }

        const toolCall = new ToolCall(`${name}-${Date.now()}`, name, params);
        toolCalls.push(toolCall);
      } catch (e: any) {
        console.error("Failed to parse tool call:", e.message);
        console.log("XML content:", match[0]);
        // Continue processing other matches
      }
    }

    return toolCalls;
  }
}
