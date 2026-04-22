import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { McpResultEnvelope } from './shared/result-envelope.js';
import { toCallToolResult } from './shared/to-call-tool-result.js';
import { buildSwapTxInputSchema, quoteRoutesInputSchema, trackStatusInputSchema } from './tool-contracts.js';
import { BuildSwapTxTool } from './tools/build-swap-tx.tool.js';
import { QuoteRoutesTool } from './tools/quote-routes.tool.js';
import { TrackStatusTool } from './tools/track-status.tool.js';

export class McpServerFactory {
    constructor(
        private readonly buildSwapTxTool: BuildSwapTxTool,
        private readonly quoteRoutesTool: QuoteRoutesTool,
        private readonly trackStatusTool: TrackStatusTool,
        private readonly timeoutMs: number
    ) {}

    public createServer(): McpServer {
        const server = new McpServer({
            name: 'rubic-api-mcp',
            version: '1.0.0'
        });

        server.registerTool(
            QuoteRoutesTool.name,
            {
                description: 'Calculate Rubic routes and return the best route or all candidate routes.',
                inputSchema: quoteRoutesInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(QuoteRoutesTool.name, () =>
                    this.quoteRoutesTool.execute(args, randomUUID())
                );
                return toCallToolResult(result);
            }
        );

        server.registerTool(
            BuildSwapTxTool.name,
            {
                description: 'Build executable swap transaction data using route id from quote step.',
                inputSchema: buildSwapTxInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(BuildSwapTxTool.name, () =>
                    this.buildSwapTxTool.execute(args, randomUUID())
                );
                return toCallToolResult(result);
            }
        );

        server.registerTool(
            TrackStatusTool.name,
            {
                description: 'Track cross-chain trade status by rubic id and/or source tx hash.',
                inputSchema: trackStatusInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(TrackStatusTool.name, () =>
                    this.trackStatusTool.execute(args, randomUUID())
                );
                return toCallToolResult(result);
            }
        );

        return server;
    }

    private async executeWithTelemetry<TData>(
        toolName: string,
        handler: () => Promise<McpResultEnvelope<TData>>
    ): Promise<McpResultEnvelope<TData>> {
        const startedAt = Date.now();
        const result = await Promise.race([handler(), this.createTimeoutResult<TData>(toolName)]);
        const durationMs = Date.now() - startedAt;
        const resultLabel = result.ok ? 'ok' : 'error';

        console.error(`tool=${toolName} durationMs=${durationMs} result=${resultLabel} traceId=${result.traceId}`);
        return result;
    }

    private async createTimeoutResult<TData>(toolName: string): Promise<McpResultEnvelope<TData>> {
        await new Promise((resolve) => setTimeout(resolve, this.timeoutMs));
        return {
            error: {
                code: 'TOOL_TIMEOUT',
                message: `${toolName} execution exceeded timeout.`
            },
            ok: false,
            traceId: randomUUID()
        };
    }
}
