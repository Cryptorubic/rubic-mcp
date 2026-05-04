import { ApiClient } from '../api/api-client.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { normalizeTokenAddresses } from '../shared/normalize-fake-native-token-address.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { BuildSwapTxValidatedInput, SimulateSwapValidatedInput, simulateSwapValidationSchema } from '../tool-contracts.js';
import { QuoteAllDto, QuoteResponseDto, SimulateSwapOutput, SimulationRiskLevel, SwapResponseDto } from '../types/api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

export class SimulateSwapTool {
    public static readonly name = 'rubic_simulate_swap';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly apiClient: ApiClient,
        private readonly validationService: McpValidationService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<SimulateSwapOutput>> {
        try {
            const validatedInput = this.validationService.validate<SimulateSwapValidatedInput>(simulateSwapValidationSchema, input);
            const quoteResult = await this.getQuoteResult(validatedInput, traceId);
            const route = this.pickRoute(quoteResult.result, validatedInput.selectedRouteId);

            if (!route) {
                throw new Error('Unable to resolve route for simulation. Set selectedRouteId explicitly or request a valid quote.');
            }

            const includeBuild = validatedInput.includeBuild ?? true;
            const swap = includeBuild ? await this.buildSwap(validatedInput, route.id, traceId) : null;

            const totalCostUsd = this.getTotalCostUsd(swap?.fees ?? route.fees);
            const estimatedGasUsd = (swap?.fees ?? route.fees).gasTokenFees.gas.totalUsdAmount;
            const reasons = this.getRiskReasons(route.estimate.priceImpact, route.warnings.length);

            return {
                data: {
                    quote: route,
                    swap,
                    summary: {
                        durationInMinutes: route.estimate.durationInMinutes,
                        estimatedGasUsd,
                        expectedOutputAmount: route.estimate.destinationTokenAmount,
                        expectedOutputMinAmount: route.estimate.destinationTokenMinAmount,
                        expectedOutputUsd: route.estimate.destinationUsdAmount ?? null,
                        priceImpact: route.estimate.priceImpact,
                        reasons,
                        riskLevel: this.getRiskLevel(route.estimate.priceImpact, route.warnings.length),
                        routeId: route.id,
                        slippage: route.estimate.slippage,
                        totalCostUsd
                    }
                },
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

    private async getQuoteResult(input: SimulateSwapValidatedInput, traceId: string) {
        const mode = input.routeMode ?? 'best';
        const { includeBuild: _includeBuild, routeMode: _routeMode, selectedRouteId: _selectedRouteId, ...quotePayload } = input;
        const normalizedPayload = normalizeTokenAddresses(quotePayload);
        return this.apiClient.quoteRoutes({ ...normalizedPayload, routeMode: mode }, traceId);
    }

    private pickRoute(result: QuoteResponseDto | QuoteAllDto, selectedRouteId?: string): QuoteResponseDto | undefined {
        if ('id' in result) {
            if (!selectedRouteId) {
                return result;
            }

            return result.id === selectedRouteId ? result : undefined;
        }

        if (selectedRouteId) {
            return result.routes.find((route) => route.id === selectedRouteId);
        }

        return result.routes[0];
    }

    private async buildSwap(input: SimulateSwapValidatedInput, routeId: string, traceId: string): Promise<SwapResponseDto | null> {
        const fromAddress = input.fromAddress ?? this.walletService.getWalletAddress();
        const receiver = input.receiver ?? fromAddress;

        if (!fromAddress || !receiver) {
            return null;
        }

        const buildPayload: BuildSwapTxValidatedInput & { fromAddress: string; receiver: string } = normalizeTokenAddresses({
            id: routeId,
            srcTokenAddress: input.srcTokenAddress,
            srcTokenBlockchain: input.srcTokenBlockchain,
            srcTokenAmount: input.srcTokenAmount,
            dstTokenAddress: input.dstTokenAddress,
            dstTokenBlockchain: input.dstTokenBlockchain,
            fromAddress,
            receiver,
            slippage: input.slippage
        });

        return this.apiClient.buildSwapTx(buildPayload, traceId);
    }

    private getTotalCostUsd(fees: QuoteResponseDto['fees']): number {
        const gas = fees.gasTokenFees.gas.totalUsdAmount ?? 0;
        const protocol = fees.gasTokenFees.protocol.fixedUsdAmount ?? 0;
        const provider = fees.gasTokenFees.provider.fixedUsdAmount ?? 0;
        return gas + protocol + provider;
    }

    private getRiskLevel(priceImpact: number | null, warningCount: number): SimulationRiskLevel {
        if (warningCount > 0 || (priceImpact !== null && priceImpact >= 0.15)) {
            return 'high';
        }

        if (priceImpact !== null && priceImpact >= 0.05) {
            return 'medium';
        }

        return 'low';
    }

    private getRiskReasons(priceImpact: number | null, warningCount: number): string[] {
        const reasons: string[] = [];
        if (warningCount > 0) {
            reasons.push('Route contains provider warnings.');
        }

        if (priceImpact !== null && priceImpact >= 0.15) {
            reasons.push('Price impact is elevated (>= 15%).');
        } else if (priceImpact !== null && priceImpact >= 0.05) {
            reasons.push('Price impact is moderate (>= 5%).');
        }

        if (reasons.length === 0) {
            reasons.push('No explicit route risk signals detected.');
        }

        return reasons;
    }
}
