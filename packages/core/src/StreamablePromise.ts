import { EventEmitter } from "node:events";

/**
 * A hybrid class that combines EventEmitter and Promise functionality.
 * Can be used for streaming (listen to events) or awaited for final result.
 */
export class StreamablePromise<T> extends EventEmitter implements Promise<T> {
  private promise: Promise<T>;

  constructor(
    executor: (
      resolve: (value: T) => void,
      reject: (reason?: any) => void,
    ) => void,
  ) {
    super();
    this.promise = new Promise((resolve, reject) => {
      executor(
        (value: T) => {
          this.emit("resolve", value);
          resolve(value);
        },
        (reason?: any) => {
          this.emit("reject", reason);
          reject(reason);
        },
      );
    });
  }

  // Promise interface implementation
  then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | null
      | undefined,
  ): Promise<T | TResult> {
    return this.promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null | undefined): Promise<T> {
    return this.promise.finally(onfinally);
  }

  // Symbol for Promise compatibility
  readonly [Symbol.toStringTag] = "Promise";
}
