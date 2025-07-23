import { ToolCall } from "./ToolCall.ts";

export class Message {
  constructor(
    public role: "user" | "assistant" | "system" | "tool",
    public content: string,
    public toolCalls?: ToolCall[],
  ) {}
}
