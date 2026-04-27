import { ApiClient } from '../api/api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { normalizeTokenAddresses } from '../shared/normalize-fake-native-token-address.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { BuildSwapTxValidatedInput, buildSwapTxValidationSchema } from '../tool-contracts.js';
import { SwapResponseDto } from '../types/api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

export class BuildSwapTxTool {
    public static readonly name = 'rubic_build_swap_tx';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly apiClient: ApiClient,
        private readonly validationService: McpValidationService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<SwapResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<BuildSwapTxValidatedInput>(buildSwapTxValidationSchema, input);
            const normalizedInput = normalizeTokenAddresses(validatedInput);
            const fromAddress = normalizedInput.fromAddress ?? this.walletService.getWalletAddress();
            const receiver = normalizedInput.receiver ?? fromAddress;

            if (!fromAddress || !receiver) {
                throw new Error(
                    'fromAddress and receiver are required when EVM_WALLET_PRIVATE_KEY is not configured. Provide both fields explicitly.'
                );
            }

            const swapData = await this.apiClient.buildSwapTx(
                {
                    ...normalizedInput,
                    fromAddress,
                    receiver
                },
                traceId
            );

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
