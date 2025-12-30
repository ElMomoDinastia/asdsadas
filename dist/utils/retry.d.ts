type RetryableFunction<T> = () => Promise<T>;
interface RetryOptions {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
}
export declare function withRetry<T>(fn: RetryableFunction<T>, options?: RetryOptions): Promise<T>;
/**
 * Sleep for a specified duration
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Create a timeout promise that rejects after specified duration
 */
export declare function timeout<T>(promise: Promise<T>, ms: number, errorMessage?: string): Promise<T>;
export declare function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delayMs: number): (...args: Parameters<T>) => void;
export {};
//# sourceMappingURL=retry.d.ts.map