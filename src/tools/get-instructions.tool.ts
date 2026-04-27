import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const instructionsFilePath = resolve(currentDirPath, '../../SKILL.md');

export class GetInstructionsTool {
    public static readonly name = 'rubic_get_instructions';

    constructor(private readonly errorMapper: McpErrorMapper) {}

    public async execute(_input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<string>> {
        try {
            const content = await readFile(instructionsFilePath, 'utf-8');

            return {
                data: content,
                ok: true,
                traceId
            };
        } catch (error) {
            return {
                error: this.errorMapper.toToolError(error),
                ok: false,
                traceId
            };
        }
    }
}
