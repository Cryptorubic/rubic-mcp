import { ApiClient } from '../api/api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { SearchTokensValidatedInput, searchTokensValidationSchema } from '../tool-contracts.js';
import { SearchTokensResponseDto } from '../types/api.dto.js';

export class SearchTokensTool {
    public static readonly name = 'rubic_search_tokens';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly apiClient: ApiClient,
        private readonly validationService: McpValidationService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<SearchTokensResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<SearchTokensValidatedInput>(searchTokensValidationSchema, input);
            const result = await this.apiClient.searchTokens(validatedInput);

            return {
                data: result,
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
