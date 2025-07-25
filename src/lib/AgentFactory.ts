import { Agent, FailoverAgent } from "@fraimwork/core";
import { createModelConfig, createModelConfigs } from "../models";

export class AgentFactory {
  static getAgent<T extends Agent>(
    agentClass: new (...args: any[]) => T,
    modelName = (agentClass as any).defaultModel,
  ): T {
    // Check if the agent class extends FailoverAgent
    if (AgentFactory.isFailoverAgent(agentClass)) {
      // For FailoverAgent subclasses, we need to provide model configs
      // @ts-ignore
      const modelConfigs = createModelConfigs(agentClass.modelNames);
      return new agentClass(modelConfigs);
    } else {
      // For regular Agent subclasses, use the new ModelConfig constructor
      const modelConfig = createModelConfig(modelName);
      return new agentClass(modelConfig);
    }
  }

  /**
   * Check if an agent class extends FailoverAgent
   */
  private static isFailoverAgent(agentClass: any): boolean {
    let currentClass = agentClass;
    while (currentClass && currentClass !== Agent) {
      if (
        currentClass.name === "FailoverAgent" ||
        currentClass === FailoverAgent ||
        currentClass.prototype instanceof FailoverAgent
      ) {
        return true;
      }
      currentClass = Object.getPrototypeOf(currentClass);
    }
    return false;
  }

  /**
   * Create any FailoverAgent with custom model keys
   */
  static getFailoverAgent<T extends FailoverAgent>(
    agentClass: new (modelConfigs: any[]) => T,
    modelKeys: string[],
  ): T {
    const modelConfigs = createModelConfigs(modelKeys);
    return new agentClass(modelConfigs);
  }
}
