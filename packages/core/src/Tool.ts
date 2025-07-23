import { JSONSchema7 } from "json-schema";

export class Tool {
  type = "function";
  public readonly name: string;
  public readonly description?: string;
  public readonly parameters?: JSONSchema7;

  constructor(
    props: {
      name: string;
      description: string;
      parameters?: Record<string, JSONSchema7>;
      required?: string[];
    },
    public readonly callback: (args: Record<string, any>) => Promise<string>,
  ) {
    this.name = props.name;
    this.description = props.description;

    if (props.parameters && Object.keys(props.parameters).length > 0) {
      this.parameters = {
        type: "object",
        properties: props.parameters,
        required: props.required || [],
      };
    }
  }

  public async call(args: Record<string, any>): Promise<string> {
    try {
      return await this.callback(args);
    } catch (e: any) {
      return e.message;
    }
  }
}
