import { ApiClient } from '../api/api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { GetBalancesValidatedInput, getBalancesValidationSchema } from '../tool-contracts.js';
import { GetBalancesResponseDto } from '../types/rubic-api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

export class GetBalancesTool {
    public static readonly name = 'rubic_get_balances';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly apiClient: ApiClient,
        private readonly validationService: McpValidationService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<GetBalancesResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<GetBalancesValidatedInput>(getBalancesValidationSchema, input);
            const userAddress = validatedInput.address ?? this.walletService.getWalletAddress();
            if (!userAddress) {
                throw new Error('address is required when WALLET_PRIVATE_KEY is not configured.');
            }

            const data = await this.apiClient.getBalances(userAddress, validatedInput.blockchains);

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
