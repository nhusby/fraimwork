import { Message } from "./Message.ts";
import { ToolMessage } from "./ToolMessage.ts";

/**
 * Represents a tool invocation
 */
export class ToolCall {
  public result?: string;

  public constructor(
    // id provided by LLM
    public id: string,
    // The tool name
    public name: string = "",
    // arguments to provide the tool invocation
    public args: {
      [key: string]: any; // The arguments for the tool, as an object
    } = {},
  ) {}

  /**
   * Retrieves a message instance based on the current result or an empty string if no result exists.
   *
   * @return {Message} An instance of ToolMessage constructed using the result or an empty string, and the provided ID.
   */
  public get message(): Message {
    return new ToolMessage(this.result || "", this.id);
  }
}
