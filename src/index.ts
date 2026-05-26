#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ApiClient } from './api/api-client.js';
import { config } from './config.js';
import { startHttpServer } from './http-server.js';
import { McpServerFactory } from './mcp-server.factory.js';
import { RpcService } from './services/rpc.service.js';
import { McpErrorMapper } from './shared/error-mapper.js';
import { McpValidationService } from './shared/validation.service.js';
import { BroadcastTxTool } from './tools/broadcast-tx.tool.js';
import { BuildSwapTxTool } from './tools/build-swap-tx.tool.js';
import { GetBalancesTool } from './tools/get-balances.tool.js';
import { GetInstructionsTool } from './tools/get-instructions.tool.js';
import { GetSupportedChainsTool } from './tools/get-supported-chains.tool.js';
import { GetSwapUrlTool } from './tools/get-swap-url.tool.js';
import { QuoteRoutesTool } from './tools/quote-routes.tool.js';
import { SearchTokensTool } from './tools/search-tokens.tool.js';
import { SignTxTool } from './tools/sign-tx.tool.js';
import { SimulateSwapTool } from './tools/simulate-swap.tool.js';
import { TrackStatusTool } from './tools/track-status.tool.js';
import { WalletService } from './wallet/wallet.service.js';

const createFactory = (): McpServerFactory => {
    const errorMapper = new McpErrorMapper();
    const validationService = new McpValidationService();
    const apiClient = new ApiClient(config.apiTimeoutMs);
    const rpcService = new RpcService();

    rpcService.init();

    const walletService = new WalletService(rpcService, config.evmWalletPrivateKey);

    const getInstructionsTool = new GetInstructionsTool(errorMapper);
    const getBalancesTool = new GetBalancesTool(errorMapper, validationService, rpcService, walletService);
    const getSupportedChainsTool = new GetSupportedChainsTool();
    const searchTokensTool = new SearchTokensTool(errorMapper, apiClient, validationService);
    const quoteRoutesTool = new QuoteRoutesTool(errorMapper, apiClient, validationService);
    const simulateSwapTool = new SimulateSwapTool(errorMapper, apiClient, validationService, walletService);
    const buildSwapTxTool = new BuildSwapTxTool(errorMapper, apiClient, validationService, walletService);
    const signTxTool = new SignTxTool(errorMapper, validationService, walletService);
    const broadcastTxTool = new BroadcastTxTool(errorMapper, validationService, walletService);
    const trackStatusTool = new TrackStatusTool(errorMapper, apiClient, validationService);
    const getSwapUrlTool = new GetSwapUrlTool(errorMapper, validationService);

    return new McpServerFactory(
        walletService,
        getInstructionsTool,
        getBalancesTool,
        getSupportedChainsTool,
        buildSwapTxTool,
        broadcastTxTool,
        quoteRoutesTool,
        simulateSwapTool,
        searchTokensTool,
        signTxTool,
        trackStatusTool,
        getSwapUrlTool,
        config.toolTimeoutMs
    );
};

async function start(): Promise<void> {
    const factory = createFactory();

    if (config.transport === 'http') {
        await startHttpServer(factory, config.host, config.port);
        return;
    }

    const server = factory.createServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Rubic MCP server is running over stdio.');
}

start().catch((error) => {
    console.error('Failed to start Rubic MCP server', error);
    process.exit(1);
});
