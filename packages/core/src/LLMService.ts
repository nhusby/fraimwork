import { Message } from "./Message.ts";
import { Tool } from "./Tool.ts";
import { ToolCall } from "./ToolCall.ts";
import { StreamablePromise } from "./StreamablePromise.ts";
import { EventEmitter } from "node:events";

export abstract class LLMService {
  public readonly model: string;
  public readonly parseToolCalls: boolean;

  constructor(model: string, parseToolCalls: boolean = false) {
    this.model = model;
    this.parseToolCalls = parseToolCalls;
  }

  public send(params: {
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  }): StreamablePromise<Message> {
    const processedParams = { ...params };
    if (this.parseToolCalls && params.tools) {
      processedParams.messages = [
        this.generateToolsSystemMessage(params.tools),
        ...params.messages,
      ];
      delete processedParams.tools;
    }

    return this._send(processedParams);
  }

  protected abstract _send(params: {
    messages: Message[];
    tools?: Tool[];
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  }): StreamablePromise<Message>;

  protected handleStreamingWithToolParsing(
    sourceEmitter: EventEmitter,
  ): EventEmitter {
    if (!this.parseToolCalls) {
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
          resultEmitter.emit("chunk", toolBuffer);
          toolBuffer = "";
        } else {
          if (toolBuffer.match(/<Tool_?Call>.*?<\/Tool_?Call>/is)) {
            toolBuffer = "";
          }
        }
      } else {
        resultEmitter.emit("chunk", chunk);
      }
    });

    sourceEmitter.on("error", (error) => {
      resultEmitter.emit("error", error);
    });

    sourceEmitter.on("complete", (message: Message) => {
      if (toolBuffer && !toolBuffer.match(/<Tool_?Call>/i)) {
        resultEmitter.emit("chunk", toolBuffer);
      }

      this.processMessageToolCalls(message, this.parseToolCalls);

      if (message.toolCalls?.length) {
        for (const toolCall of message.toolCalls) {
          resultEmitter.emit("toolCall", toolCall);
        }
      }

      resultEmitter.emit("complete", message);
    });

    return resultEmitter;
  }

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
{\"tool\": \"ToolName\", \"parameters\": {\"param1\": \"value1\", \"param2\": \"value2\"}}
</ToolCall>

CRITICAL: Always use valid JSON in the <ToolCall> tag. Make sure to match brackets! each "{" must have a matching "}"\n`;

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

  protected parseToolCallsFromText(text: string): ToolCall[] {
    const toolCalls: ToolCall[] = [];
    const jsonMatches = text.matchAll(
      /<Tool_?Call>\s*(\{.*?\})\s*<\/Tool_?Call>/gis,
    );
    for (const match of jsonMatches) {
      try {
        const json = JSON.parse(match[1]!); 
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

    const xmlMatches = text.matchAll(
      /<Tool_?Call>\s*(?:<Tool_?Name>)?(.+?)(?:<\/Tool_?Name>)?\s*(<.+>.+<\/.*>)\s*<\/Tool_?Call>/gis,
    );

    for (const match of xmlMatches) {
      try {
        const name = match[1]!;
        const paramsString = match[2]!;
        const params: { [key: string]: any } = {};

        const paramMatches = paramsString.matchAll(
          /<(?:parameter name="|\w*?key>)(.+?)(?:<\/\w*?key>\s*<\w*?value>|">)(.+?)<\/(?:parameter|\w*?value)>/gis,
        );
        for (const paramMatch of paramMatches) {
          params[paramMatch[1]!] = paramMatch[2]!;
        }

        const toolCall = new ToolCall(`${name}-${Date.now()}`, name, params);
        toolCalls.push(toolCall);
      } catch (e: any) {
        console.error("Failed to parse tool call:", e.message);
        console.log("XML content:", match[0]);
      }
    }

    return toolCalls;
  }
}