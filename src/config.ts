import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);

dotenv.config({
    path: resolve(currentDirPath, '../.env'),
    quiet: true
});

type Config = {
    apiBaseUrl: string;
    apiTimeoutMs: number;
    host: string;
    port: number;
    toolTimeoutMs: number;
    transport: 'stdio' | 'http';
};

const parseNumber = (value: string | undefined, fallback: number): number => {
    if (!value) {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export const config: Config = {
    apiBaseUrl: process.env.RUBIC_API_BASE_URL || 'https://rubic-api-v2.rubic.exchange',
    apiTimeoutMs: parseNumber(process.env.RUBIC_API_TIMEOUT_MS, 60_000),
    host: process.env.MCP_HOST || '127.0.0.1',
    port: parseNumber(process.env.MCP_PORT, 3333),
    toolTimeoutMs: parseNumber(process.env.MCP_TOOL_TIMEOUT_MS, 60_000),
    transport: process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio'
};
