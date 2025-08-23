import { Agent, AgentConfig } from "./Agent.ts";
import { Message } from "./Message.ts";
import { LLMService } from "./LLMService.ts";

interface ServiceStatus {
  service: LLMService;
  failureCount: number;
  lastFailure?: Date;
}

/**
 * Agent that fails over when rate limits or other problems occur
 */
export class FailoverAgent extends Agent {
  private services: ServiceStatus[] = [];
  private currentService: ServiceStatus;

  constructor(services: LLMService[], baseConfig: Omit<AgentConfig, "llm">) {
    if (!services.length) {
      throw new Error("At least one LLM Service must be provided");
    }

    super({ ...baseConfig, llm: services[0]! });

    this.initializeServices(services);
    this.currentService = this.services[0]!;
  }

  private initializeServices(services: LLMService[]): void {
    this.services = services.map((service) => ({
      service,
      failureCount: 0,
    }));
  }

  /**
   * Rotate to the next model in the list
   */
  private rotateToNextService() {
    const currentIndex = this.services.indexOf(this.currentService);
    const nextIndex = (currentIndex + 1) % this.services.length;
    this.currentService = this.services[nextIndex]!;
    this.llmService = this.currentService.service; // Update the underlying llm service in the agent

    console.log(`🔄 Rotated to service: ${this.llmService.constructor.name}`);
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
  private recordServiceFailure(error: any): void {
    this.currentService.failureCount++;
    this.currentService.lastFailure = new Date();
    console.log(
      `❌ Service ${this.llmService.constructor.name} failed: ${error.message}`,
    );
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

    while (attempts < 3 * this.services.length) {
      try {
        // Call the parent send method with the same interface
        const result = await super.send(message, streaming);

        // Success! Reset failure count for this model
        this.currentService.failureCount = 0;
        return result;
      } catch (error) {
        lastError = error;
        this.recordServiceFailure(error);

        // Only rotate on rate limit errors, not all errors
        if (this.isRateLimitError(error)) {
          this.rotateToNextService();
        } else {
          // For non-rate-limit errors, don't rotate, just throw
          throw error;
        }
      }

      attempts++;
    }

    // If we get here, all models failed with rate limits
    throw new Error(
      `All services exhausted. Last error: ${
        lastError?.message || "Unknown error"
      }`,
    );
  }
}
