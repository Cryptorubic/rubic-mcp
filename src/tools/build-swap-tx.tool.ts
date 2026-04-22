import { RubicApiClient } from '../api/rubic-api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { normalizeTokenAddresses } from '../shared/normalize-fake-native-token-address.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { BuildSwapTxValidatedInput, buildSwapTxValidationSchema } from '../tool-contracts.js';
import { SwapResponseDto } from '../types/rubic-api.dto.js';

export class BuildSwapTxTool {
    public static readonly name = 'rubic_build_swap_tx';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly rubicApiClient: RubicApiClient,
        private readonly validationService: McpValidationService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<SwapResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<BuildSwapTxValidatedInput>(buildSwapTxValidationSchema, input);
            const normalizedInput = normalizeTokenAddresses(validatedInput);
            const swapData = await this.rubicApiClient.buildSwapTx(normalizedInput, traceId);

            return {
                data: swapData,
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
