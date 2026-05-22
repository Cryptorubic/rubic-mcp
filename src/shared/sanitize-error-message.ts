const SENSITIVE_LINE_PREFIXES = ['URL:', 'Request body:', 'Version:', 'Docs:', 'Status:'] as const;

type ViemLikeError = Error & {
    shortMessage: string;
    details?: string;
};

function isViemLikeError(error: Error): error is ViemLikeError {
    return typeof (error as ViemLikeError).shortMessage === 'string';
}

function stripSensitiveLines(message: string): string {
    const lines = message
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !SENSITIVE_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)));

    return lines.join('\n').trim();
}

function extractDetailsFromFormattedMessage(message: string): string | undefined {
    const match = message.match(/^Details:\s*(.+)$/m);

    return match?.[1]?.trim();
}

/**
 * Returns a client-safe error message without RPC URLs, request payloads, or library versions.
 */
export function sanitizeClientErrorMessage(error: Error): string {
    if (isViemLikeError(error)) {
        const details = error.details?.trim();

        if (details) {
            return details;
        }

        const shortMessage = error.shortMessage.trim();

        if (shortMessage) {
            return shortMessage;
        }

        return 'Unexpected MCP error.';
    }

    const rawMessage = error.message?.trim() || 'Unexpected MCP error.';
    const details = extractDetailsFromFormattedMessage(rawMessage);

    if (details) {
        return details;
    }

    const cleaned = stripSensitiveLines(rawMessage);

    return cleaned || 'Unexpected MCP error.';
}
