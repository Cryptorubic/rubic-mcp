import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { McpResultEnvelope } from './result-envelope.js';

export const toCallToolResult = <TData>(payload: McpResultEnvelope<TData>): CallToolResult => {
    return {
        content: [
            {
                text: JSON.stringify(payload),
                type: 'text'
            }
        ],
        isError: !payload.ok,
        structuredContent: payload as unknown as Record<string, unknown>
    };
};
