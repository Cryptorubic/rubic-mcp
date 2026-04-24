import { BLOCKCHAIN_NAME, blockchainId, BlockchainName } from '@cryptorubic/core';

import { McpResultEnvelope } from '../shared/result-envelope.js';

type GetSupportedChainsResponseDto = {
    chainId: number;
    name: BlockchainName;
}[];

export class GetSupportedChainsTool {
    public static readonly name = 'get_supported_chains';

    public async execute(_input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<GetSupportedChainsResponseDto>> {
        return {
            data: Object.values(BLOCKCHAIN_NAME).map((blockchain) => {
                return { chainId: blockchainId[blockchain], name: blockchain };
            }),
            ok: true,
            traceId
        };
    }
}
