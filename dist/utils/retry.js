"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withRetry = withRetry;
exports.sleep = sleep;
exports.timeout = timeout;
exports.debounce = debounce;
const logger_1 = require("./logger");
const DEFAULT_OPTIONS = {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    shouldRetry: () => true,
};
async function withRetry(fn, options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let lastError;
    let delay = opts.initialDelayMs;
    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            if (attempt === opts.maxRetries || !opts.shouldRetry(error)) {
                throw error;
            }
            logger_1.logger.warn({ error, attempt, maxRetries: opts.maxRetries, nextDelayMs: delay }, 'Operation failed, retrying...');
            await sleep(delay);
            delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
        }
    }
    throw lastError;
}
/**
 * Sleep for a specified duration
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Create a timeout promise that rejects after specified duration
 */
function timeout(promise, ms, errorMessage) {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(errorMessage ?? `Operation timed out after ${ms}ms`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]);
}
function debounce(fn, delayMs) {
    let timeoutId = null;
    return (...args) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            fn(...args);
        }, delayMs);
    };
}
//# sourceMappingURL=retry.js.map