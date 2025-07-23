import { Agent } from "./Agent.ts";
import { Message } from "./Message.ts";
import type { ModelConfig } from "./Agent.ts";

interface ExtendedModelConfig extends ModelConfig {
  failureCount: number;
  lastFailure?: Date;
}

/**
 * Abstract base class for agents that failover when rate limits or other problems occur
 */
export abstract class FailoverAgent extends Agent {
  protected models: ExtendedModelConfig[] = [];
  declare protected model: ExtendedModelConfig;

  constructor(modelConfigs: ModelConfig[]) {
    if (!modelConfigs.length) {
      throw new Error("At least one model config must be provided");
    }

    super(modelConfigs[0]!);

    this.initializeModels(modelConfigs);
  }

  private initializeModels(modelConfigs: ModelConfig[]): void {
    this.models = modelConfigs.map((config) => ({
      ...config,
      failureCount: 0,
    }));
    this.model = this.models[0]!;
  }

  /**
   * Rotate to the next model in the list
   */
  private rotateToNextModel() {
    const index = (this.models.indexOf(this.model) + 1) % this.models.length;
    this.model = this.models[index]!;

    console.log(`🔄 Rotated to model: ${this.model.name}`);
  }

  /**
   * Check if an error indicates a rate limit or quota issue
   */
  private isRateLimitError(error: any): boolean {
    if (!error) return false;

    const errorMessage = error.message?.toLowerCase() || "";
    const errorCode = error.status || error.code;

    // HTTP 429 Too Many Requests
    if (errorCode === 429) return true;

    // Common rate limit error messages
    const rateLimitIndicators = [
      "rate limit",
      "quota exceeded",
      "too many requests",
      "rate_limit_exceeded",
      "quota_exceeded",
      "requests per minute",
      "rpm limit",
    ];

    return rateLimitIndicators.some((indicator) =>
      errorMessage.includes(indicator),
    );
  }

  /**
   * Record a failure for the current model
   */
  private recordModelFailure(error: any): void {
    this.model.failureCount++;
    this.model.lastFailure = new Date();
    console.log(`❌ Model ${this.model.name} failed: ${error.message}`);
  }

  /**
   * Override send method to implement model rotation on failures
   */
  public override async send(
    message?: Message,
    streaming: boolean = true,
  ): Promise<Message> {
    let lastError: any;
    let attempts = 0;

    while (attempts < 3 * this.models.length) {
      try {
        // Call the parent send method with the same interface
        const result = await super.send(message, streaming);

        // Success! Reset failure count for this model
        this.model.failureCount = 0;
        return result;
      } catch (error) {
        lastError = error;
        this.recordModelFailure(error);

        // Only rotate on rate limit errors, not all errors
        if (this.isRateLimitError(error)) {
          this.rotateToNextModel();
        } else {
          // For non-rate-limit errors, don't rotate, just throw
          throw error;
        }
      }

      attempts++;
    }

    // If we get here, all models failed with rate limits
    throw new Error(
      `All models exhausted. Last error: ${lastError?.message || "Unknown error"}`,
    );
  }
}
