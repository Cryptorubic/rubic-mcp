import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { ApiClient } from './api/api-client.js';
import { config } from './config.js';
import { startHttpServer } from './http-server.js';
import { McpServerFactory } from './mcp-server.factory.js';
import { McpErrorMapper } from './shared/error-mapper.js';
import { McpValidationService } from './shared/validation.service.js';
import { BroadcastTxTool } from './tools/broadcast-tx.tool.js';
import { BuildSwapTxTool } from './tools/build-swap-tx.tool.js';
import { GetBalancesTool } from './tools/get-balances.tool.js';
import { GetSupportedChainsTool } from './tools/get-supported-chains.tool.js';
import { QuoteRoutesTool } from './tools/quote-routes.tool.js';
import { SearchTokensTool } from './tools/search-tokens.tool.js';
import { SignTxTool } from './tools/sign-tx.tool.js';
import { TrackStatusTool } from './tools/track-status.tool.js';
import { WalletService } from './wallet/wallet.service.js';

const createFactory = (): McpServerFactory => {
    const errorMapper = new McpErrorMapper();
    const validationService = new McpValidationService();
    const apiClient = new ApiClient(config.apiTimeoutMs);
    const walletService = new WalletService(config.walletPrivateKey);

    const getSupportedChainsTool = new GetSupportedChainsTool();
    const searchTokensTool = new SearchTokensTool(errorMapper, apiClient, validationService);
    const quoteRoutesTool = new QuoteRoutesTool(errorMapper, apiClient, validationService);
    const buildSwapTxTool = new BuildSwapTxTool(errorMapper, apiClient, validationService, walletService);
    const signTxTool = new SignTxTool(errorMapper, validationService, walletService);
    const broadcastTxTool = new BroadcastTxTool(errorMapper, validationService, walletService);
    const trackStatusTool = new TrackStatusTool(errorMapper, apiClient, validationService);
    const getBalancesTool = new GetBalancesTool(errorMapper, apiClient, validationService, walletService);

    return new McpServerFactory(
        walletService,
        getSupportedChainsTool,
        buildSwapTxTool,
        broadcastTxTool,
        quoteRoutesTool,
        searchTokensTool,
        signTxTool,
        trackStatusTool,
        getBalancesTool,
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
