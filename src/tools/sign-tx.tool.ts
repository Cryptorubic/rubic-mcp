import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { SignTxValidatedInput, signTxValidationSchema } from '../tool-contracts.js';
import { SignedTxResponseDto } from '../types/rubic-api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

export class SignTxTool {
    public static readonly name = 'rubic_sign_tx';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly validationService: McpValidationService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<SignedTxResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<SignTxValidatedInput>(signTxValidationSchema, input);
            const data = await this.walletService.signTransaction(validatedInput);

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
