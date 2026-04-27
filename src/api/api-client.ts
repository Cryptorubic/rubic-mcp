import { BackendBlockchain, BlockchainName, FROM_BACKEND_BLOCKCHAINS, TO_BACKEND_BLOCKCHAINS } from '@cryptorubic/core';
import axios, { AxiosInstance } from 'axios';

import { config } from '../config.js';
import {
    BuildSwapTxValidatedInput,
    QuoteRoutesValidatedInput,
    SearchTokensValidatedInput,
    TrackStatusValidatedInput
} from '../tool-contracts.js';
import { QuoteRoutesOutput, SearchTokensResponseDto, StatusResponseDto, SwapResponseDto } from '../types/api.dto.js';

interface BackendToken {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
    blockchainNetwork?: BackendBlockchain;
    network?: BlockchainName;
    usdPrice: number;
}

export class ApiClient {
    private readonly httpClient: AxiosInstance;

    constructor(timeoutMs: number) {
        this.httpClient = axios.create({
            timeout: timeoutMs
        });
    }

    public async quoteRoutes(input: QuoteRoutesValidatedInput, traceId: string): Promise<QuoteRoutesOutput> {
        const mode = input.routeMode ?? 'best';
        const { routeMode: _routeMode, ...payload } = input;

        const endpoint = mode === 'all' ? '/api/routes/quoteAll' : '/api/routes/quoteBest';
        const response = await this.httpClient.post<QuoteRoutesOutput['result']>(config.rubicApiBaseUrl + endpoint, payload, {
            headers: {
                'x-trace-id': traceId
            }
        });

        return {
            mode,
            result: response.data
        };
    }

    public async buildSwapTx(
        input: BuildSwapTxValidatedInput & { fromAddress: string; receiver: string },
        traceId: string
    ): Promise<SwapResponseDto> {
        const response = await this.httpClient.post<SwapResponseDto>(config.rubicApiBaseUrl + '/api/routes/swap', input, {
            headers: {
                'x-mcp-source': 'rubic_build_swap_tx',
                'x-trace-id': traceId
            }
        });

        return response.data;
    }

    public async trackStatus(input: TrackStatusValidatedInput): Promise<StatusResponseDto> {
        const response = await this.httpClient.get<StatusResponseDto>(config.rubicApiBaseUrl + '/api/info/statusExtended', {
            params: {
                ...(input.id ? { id: input.id } : {}),
                ...(input.srcTxHash ? { srcTxHash: input.srcTxHash } : {})
            }
        });

        return response.data;
    }

    public async searchTokens(input: SearchTokensValidatedInput): Promise<SearchTokensResponseDto> {
        const params = {
            query: input.query.trim(),
            ...(input.blockchain && { network: TO_BACKEND_BLOCKCHAINS[input.blockchain] })
        };

        const response = await this.httpClient.get<{
            results: BackendToken[];
        }>(config.tokensApiBaseUrl + '/v2/tokens', {
            params
        });

        return response.data.results
            .map((backendToken) => ({
                address: backendToken.address,
                decimals: backendToken.decimals,
                symbol: backendToken.symbol,
                name: backendToken.name,
                blockchain: (backendToken.blockchainNetwork
                    ? FROM_BACKEND_BLOCKCHAINS[backendToken.blockchainNetwork]
                    : backendToken.network)!,
                pricate: backendToken.usdPrice
            }))
            .slice(0, input.limit ?? 10);
    }
}
