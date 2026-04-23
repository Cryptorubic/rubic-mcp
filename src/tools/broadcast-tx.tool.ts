import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { BroadcastTxValidatedInput, broadcastTxValidationSchema } from '../tool-contracts.js';
import { BroadcastTxResponseDto } from '../types/rubic-api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

export class BroadcastTxTool {
    public static readonly name = 'rubic_broadcast_tx';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly validationService: McpValidationService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<BroadcastTxResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<BroadcastTxValidatedInput>(broadcastTxValidationSchema, input);
            const data = await this.walletService.broadcastTransaction(validatedInput);

            return {
                data,
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
