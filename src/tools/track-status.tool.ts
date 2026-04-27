import { ApiClient } from '../api/api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { TrackStatusValidatedInput, trackStatusValidationSchema } from '../tool-contracts.js';
import { StatusResponseDto } from '../types/rubic-api.dto.js';

export class TrackStatusTool {
    public static readonly name = 'rubic_track_status';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly apiClient: ApiClient,
        private readonly validationService: McpValidationService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<StatusResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<TrackStatusValidatedInput>(trackStatusValidationSchema, input);

            const status = await this.apiClient.trackStatus(validatedInput);

            return {
                data: status,
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
