import { RubicApiClient } from '../api/rubic-api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { normalizeTokenAddresses } from '../shared/normalize-fake-native-token-address.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { QuoteRoutesValidatedInput, quoteRoutesValidationSchema } from '../tool-contracts.js';
import { QuoteRoutesOutput } from '../types/rubic-api.dto.js';

export class QuoteRoutesTool {
    public static readonly name = 'rubic_quote_routes';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly rubicApiClient: RubicApiClient,
        private readonly validationService: McpValidationService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<QuoteRoutesOutput>> {
        try {
            const validatedInput = this.validationService.validate<QuoteRoutesValidatedInput>(quoteRoutesValidationSchema, input);
            const mode = validatedInput.routeMode ?? 'best';
            const { routeMode: _routeMode, ...quotePayload } = validatedInput;
            const normalizedPayload = normalizeTokenAddresses(quotePayload);
            const result = await this.rubicApiClient.quoteRoutes({ ...normalizedPayload, routeMode: mode }, traceId);

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
