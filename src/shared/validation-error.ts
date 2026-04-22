export class McpValidationError extends Error {
    public readonly details?: unknown;

    constructor(message: string, details?: unknown) {
        super(message);
        this.name = 'McpValidationError';
        this.details = details;
    }
}
