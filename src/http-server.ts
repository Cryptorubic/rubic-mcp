import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { IncomingMessage, ServerResponse } from 'http';

import { McpServerFactory } from './mcp-server.factory.js';

type McpHttpRequest = IncomingMessage & {
    body?: unknown;
    auth?: never;
};

type McpHttpResponse = ServerResponse & {
    headersSent: boolean;
    json(payload: unknown): McpHttpResponse;
    status(code: number): McpHttpResponse;
};

const createJsonRpcErrorResponse = (res: McpHttpResponse, statusCode: number, message: string): void => {
    res.status(statusCode).json({
        error: {
            code: -32000,
            message
        },
        id: null,
        jsonrpc: '2.0'
    });
};

export async function startHttpServer(mcpServerFactory: McpServerFactory, host: string, port: number): Promise<void> {
    const app = createMcpExpressApp({ host });

    app.post('/mcp', async (req: McpHttpRequest, res: McpHttpResponse) => {
        const server = mcpServerFactory.createServer();
        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined
        });

        try {
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('Failed to process MCP request', error);
            if (!res.headersSent) {
                createJsonRpcErrorResponse(res, 500, 'Internal server error');
            }
        } finally {
            await transport.close();
            await server.close();
        }
    });

    app.get('/mcp', (_req: unknown, res: McpHttpResponse) => {
        createJsonRpcErrorResponse(res, 405, 'Method not allowed.');
    });

    app.delete('/mcp', (_req: unknown, res: McpHttpResponse) => {
        createJsonRpcErrorResponse(res, 405, 'Method not allowed.');
    });

    await new Promise<void>((resolve) => {
        app.listen(port, host, () => {
            console.error(`Rubic MCP server is listening on http://${host}:${port}/mcp`);
            resolve();
        });
    });
}
