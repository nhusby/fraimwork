import { Message } from "./Message.ts";

export class ToolMessage extends Message {
  constructor(
    content: string,
    public toolCallId: string,
  ) {
    super("tool", content);
  }
}
