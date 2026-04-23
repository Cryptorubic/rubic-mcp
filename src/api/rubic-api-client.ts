import axios, { AxiosInstance } from 'axios';

import { BuildSwapTxValidatedInput, QuoteRoutesValidatedInput, TrackStatusValidatedInput } from '../tool-contracts.js';
import { QuoteRoutesOutput, StatusResponseDto, SwapResponseDto } from '../types/rubic-api.dto.js';

export class RubicApiClient {
    private readonly httpClient: AxiosInstance;

    constructor(baseUrl: string, timeoutMs: number) {
        this.httpClient = axios.create({
            baseURL: baseUrl,
            timeout: timeoutMs
        });
    }

    public async quoteRoutes(input: QuoteRoutesValidatedInput, traceId: string): Promise<QuoteRoutesOutput> {
        const mode = input.routeMode ?? 'best';
        const { routeMode: _routeMode, ...payload } = input;

        const endpoint = mode === 'all' ? '/api/routes/quoteAll' : '/api/routes/quoteBest';
        const response = await this.httpClient.post<QuoteRoutesOutput['result']>(endpoint, payload, {
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
        const response = await this.httpClient.post<SwapResponseDto>('/api/routes/swap', input, {
            headers: {
                'x-mcp-source': 'rubic_build_swap_tx',
                'x-trace-id': traceId
            }
        });

        return response.data;
    }

    public async trackStatus(input: TrackStatusValidatedInput): Promise<StatusResponseDto> {
        const response = await this.httpClient.get<StatusResponseDto>('/api/info/statusExtended', {
            params: {
                ...(input.id ? { id: input.id } : {}),
                ...(input.srcTxHash ? { srcTxHash: input.srcTxHash } : {})
            }
        });

        return response.data;
    }
}
