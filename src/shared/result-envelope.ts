export interface McpToolError {
    code: string;
    message: string;
    details?: unknown;
    statusCode?: number;
}

export interface McpResultEnvelope<TData> {
    ok: boolean;
    traceId: string;
    data?: TData;
    error?: McpToolError;
}
