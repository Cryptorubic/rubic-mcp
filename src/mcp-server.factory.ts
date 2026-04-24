import { randomUUID } from 'node:crypto';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { McpResultEnvelope } from './shared/result-envelope.js';
import { toCallToolResult } from './shared/to-call-tool-result.js';
import {
    broadcastTxInputSchema,
    buildSwapTxInputSchema,
    quoteRoutesInputSchema,
    quoteSwapSignBroadcastInputSchema,
    signTxInputSchema,
    trackStatusInputSchema
} from './tool-contracts.js';
import { BroadcastTxTool } from './tools/broadcast-tx.tool.js';
import { BuildSwapTxTool } from './tools/build-swap-tx.tool.js';
import { QuoteRoutesTool } from './tools/quote-routes.tool.js';
import { SignTxTool } from './tools/sign-tx.tool.js';
import { TrackStatusTool } from './tools/track-status.tool.js';
import { BroadcastTxResponseDto, QuoteAllDto, QuoteResponseDto } from './types/rubic-api.dto.js';
import { WalletService } from './wallet/wallet.service.js';

const signAndBroadcastTxToolName = 'rubic_sign_and_broadcast_tx';
const quoteSwapSignAndBroadcastTxToolName = 'rubic_quote_swap_sign_and_broadcast_tx';

export class McpServerFactory {
    private readonly walletAddress;

    constructor(
        private readonly walletService: WalletService,
        private readonly buildSwapTxTool: BuildSwapTxTool,
        private readonly broadcastTxTool: BroadcastTxTool,
        private readonly quoteRoutesTool: QuoteRoutesTool,
        private readonly signTxTool: SignTxTool,
        private readonly trackStatusTool: TrackStatusTool,
        private readonly timeoutMs: number
    ) {
        this.walletAddress = this.walletService.getWalletAddress();
    }

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
                description: this.walletAddress
                    ? `Build executable swap transaction data using route id from quote step. If fromAddress and receiver are not passed, ${this.walletAddress} is used as default.`
                    : 'Build executable swap transaction data using route id from quote step. fromAddress and receiver are required.',
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
            SignTxTool.name,
            {
                description: 'Sign an EVM transaction using WALLET_PRIVATE_KEY from .env.',
                inputSchema: signTxInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(SignTxTool.name, () => this.signTxTool.execute(args, randomUUID()));
                return toCallToolResult(result);
            }
        );

        server.registerTool(
            BroadcastTxTool.name,
            {
                description: 'Broadcast a raw signed EVM transaction to the selected blockchain network.',
                inputSchema: broadcastTxInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(BroadcastTxTool.name, () =>
                    this.broadcastTxTool.execute(args, randomUUID())
                );
                return toCallToolResult(result);
            }
        );

        server.registerTool(
            signAndBroadcastTxToolName,
            {
                description:
                    'Sign an EVM transaction using WALLET_PRIVATE_KEY from .env and immediately broadcast it to the selected blockchain network.',
                inputSchema: signTxInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(signAndBroadcastTxToolName, () => this.executeSignAndBroadcastTx(args));
                return toCallToolResult(result);
            }
        );

        server.registerTool(
            quoteSwapSignAndBroadcastTxToolName,
            {
                description:
                    'Execute full flow quote -> build swap tx -> sign -> broadcast. Uses best route by default, or selectedRouteId when provided.',
                inputSchema: quoteSwapSignBroadcastInputSchema
            },
            async (args) => {
                const result = await this.executeWithTelemetry(quoteSwapSignAndBroadcastTxToolName, async () => {
                    const quoteResult = await this.quoteRoutesTool.execute(args, randomUUID());

                    if (!quoteResult.ok || !quoteResult.data) {
                        return {
                            error: quoteResult.error ?? {
                                code: 'QUOTE_ROUTES_FAILED',
                                message: 'Failed to calculate routes.'
                            },
                            ok: false,
                            traceId: quoteResult.traceId
                        };
                    }

                    const payload = args as Record<string, unknown>;
                    const selectedRouteId = typeof payload.selectedRouteId === 'string' ? payload.selectedRouteId : undefined;
                    const routeId = selectedRouteId ?? this.extractRouteIdFromQuoteResult(quoteResult.data.result);

                    if (!routeId) {
                        return {
                            error: {
                                code: 'ROUTE_ID_NOT_FOUND',
                                message: 'Unable to resolve route id from quote response. Set selectedRouteId explicitly.'
                            },
                            ok: false,
                            traceId: randomUUID()
                        };
                    }

                    const swapResult = await this.buildSwapTxTool.execute(
                        {
                            id: routeId,
                            srcTokenBlockchain: payload.srcTokenBlockchain,
                            srcTokenAddress: payload.srcTokenAddress,
                            srcTokenAmount: payload.srcTokenAmount,
                            dstTokenBlockchain: payload.dstTokenBlockchain,
                            dstTokenAddress: payload.dstTokenAddress,
                            fromAddress: payload.fromAddress,
                            receiver: payload.receiver,
                            refundAddress: payload.refundAddress,
                            enableChecks: payload.enableChecks,
                            signature: payload.signature
                        },
                        randomUUID()
                    );

                    if (!swapResult.ok || !swapResult.data) {
                        return {
                            error: swapResult.error ?? {
                                code: 'BUILD_SWAP_TX_FAILED',
                                message: 'Failed to build swap transaction.'
                            },
                            ok: false,
                            traceId: swapResult.traceId
                        };
                    }

                    return this.executeSignAndBroadcastTx({
                        blockchain: swapResult.data.quote.srcTokenBlockchain,
                        fromAddress: swapResult.data.quote.fromAddress,
                        transaction: swapResult.data.transaction
                    });
                });
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

    private async executeSignAndBroadcastTx(args: Record<string, unknown>): Promise<McpResultEnvelope<BroadcastTxResponseDto>> {
        const signResult = await this.signTxTool.execute(args, randomUUID());

        if (!signResult.ok || !signResult.data) {
            return {
                error: signResult.error ?? {
                    code: 'SIGN_TX_FAILED',
                    message: 'Failed to sign transaction.'
                },
                ok: false,
                traceId: signResult.traceId
            };
        }

        const broadcastResult = await this.broadcastTxTool.execute(
            {
                blockchain: signResult.data.blockchain,
                signedTransaction: signResult.data.signedTransaction
            },
            randomUUID()
        );

        if (!broadcastResult.ok || !broadcastResult.data) {
            return {
                error: broadcastResult.error ?? {
                    code: 'BROADCAST_TX_FAILED',
                    message: 'Failed to broadcast signed transaction.'
                },
                ok: false,
                traceId: broadcastResult.traceId
            };
        }

        return {
            data: {
                blockchain: signResult.data.blockchain,
                txHash: broadcastResult.data.txHash
            },
            ok: true,
            traceId: broadcastResult.traceId
        };
    }

    private extractRouteIdFromQuoteResult(result: QuoteResponseDto | QuoteAllDto): string | undefined {
        if ('id' in result) {
            return result.id;
        }

        return result.routes[0]?.id;
    }
}
