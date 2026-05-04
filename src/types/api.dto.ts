import { BlockchainName, CrossChainTradeType, OnChainTradeType } from '@cryptorubic/core';
import { TronParameters } from '@cryptorubic/web3';

export type SwapType = 'cross-chain' | 'on-chain';
export type QuoteRouteMode = 'all' | 'best';

export interface ForeignBlacklistDto {
    dflow: string[];
    lifi: string[];
    rango: string[];
    zerox: string[];
}

export interface QuoteRequestDto {
    srcTokenAddress: string;
    srcTokenBlockchain: BlockchainName;
    srcTokenAmount: string;
    dstTokenAddress: string;
    dstTokenBlockchain: BlockchainName;
    integratorAddress?: string;
    fromAddress?: string;
    slippage?: number;
    receiver?: string;
    nativeBlacklist?: (CrossChainTradeType | OnChainTradeType)[];
    preferredProvider?: CrossChainTradeType | OnChainTradeType;
    foreignBlacklist?: ForeignBlacklistDto;
    timeout?: number;
    enableTestnets?: boolean;
    referrer?: string;
    enableChecks?: boolean;
    skipFeeProviders?: boolean;
    showFailedRoutes?: boolean;
    showDangerousRoutes?: boolean;
    depositTradeParams?: 'onlyDeposits' | 'noDeposits' | 'all';
}

export interface SwapRequestDto extends Omit<QuoteRequestDto, 'fromAddress'> {
    id: string;
    fromAddress: string;
    receiver: string | undefined;
    signature?: string;
    publicKey?: string;
    refundAddress?: string;
    sponsorGas?: boolean;
    makeLogs?: boolean;
}

export interface TokenDto {
    address: string;
    decimals: number;
    symbol: string;
    name: string;
    blockchain: BlockchainName;
    price?: number;
}

export type SearchTokensResponseDto = TokenDto[];

export interface TokenAmountDto extends TokenDto {
    amount: string;
}

export interface QuoteTokensDto {
    from: TokenAmountDto;
    to: TokenDto;
}

export interface GasFeeDto {
    gasPrice: string | null;
    baseFee: string | null;
    maxFeePerGas: string | null;
    maxPriorityFeePerGas: string | null;
    gasLimit: string | null;
    totalWeiAmount: string | null;
    totalUsdAmount: number | null;
}

export interface ProtocolFeeDto {
    fixedAmount: string;
    fixedWeiAmount: string;
    fixedUsdAmount: number;
}

export interface ProviderFeeDto {
    fixedAmount: string;
    fixedWeiAmount: string;
    fixedUsdAmount: number;
}

export interface PercentFeeDto {
    percent: number;
    token: TokenDto | null;
}

export interface FeesDto {
    gasTokenFees: {
        gas: GasFeeDto;
        protocol: ProtocolFeeDto;
        provider: ProviderFeeDto;
        nativeToken: TokenDto;
    };
    percentFees: PercentFeeDto;
}

export interface EstimatesDto {
    destinationTokenAmount: string;
    destinationTokenMinAmount: string;
    destinationWeiAmount: string;
    destinationWeiMinAmount: string;
    destinationUsdAmount?: number;
    destinationUsdMinAmount?: number;
    durationInMinutes: number;
    slippage: number;
    priceImpact: number | null;
    intermidiateTokenWeiAmount: string;
}

export interface RoutingDto {
    type: SwapType;
    provider: string;
    path: TokenAmountDto[];
}

export interface TonEncodedConfigDto {
    address: string;
    amount: string;
    payload?: string;
    stateInit?: string;
}

export interface TransactionDto {
    approvalAddress?: string;
    permit2Address?: string;
    data?: string;
    to?: string;
    value?: string;
    depositAddress?: string;
    amountToSend?: string;
    extraFields?: object;
    exchangeId?: string;
    tonMessages?: TonEncodedConfigDto[];
    psbt?: string;
    signInputs?: number[];
    feeLimit?: number;
    callValue?: string;
    signature?: string;
    arguments?: TronParameters;
    rawParameter?: string;
    transaction?: string;
}

export interface ErrorDto {
    code: number;
    reason: string;
    data?: object;
}

export interface UniqueInfoDto {
    changenowId?: string;
    changellyId?: string;
    simpleSwapId?: string;
    retroBridgeId?: string;
    squidrouterRequestId?: string;
    rangoRequestId?: string;
    retrobridgeId?: string;
    relayId?: string;
    exolixId?: string;
    quickexId?: string;
    acrossId?: string;
    nearIntentsId?: string;
    houdiniId?: string;
    clearswapId?: string;
    additionalData?: Record<string, string | number | boolean | null>;
}

export interface FailedQuoteDto {
    providerType: CrossChainTradeType | OnChainTradeType;
    data: ErrorDto;
    id: string;
}

export interface QuoteResponseDto {
    id: string;
    tokens: QuoteTokensDto;
    swapType: SwapType;
    providerType: CrossChainTradeType | OnChainTradeType;
    estimate: EstimatesDto;
    fees: FeesDto;
    routing: RoutingDto[];
    transaction: TransactionDto;
    warnings: ErrorDto[];
    useRubicContract: boolean;
}

export interface QuoteAllDto {
    quote: QuoteRequestDto;
    routes: Omit<QuoteResponseDto, 'quote'>[];
    failed?: Omit<FailedQuoteDto, 'quote'>[];
}

export interface QuoteRoutesOutput {
    mode: QuoteRouteMode;
    result: QuoteAllDto | QuoteResponseDto;
}

export type SimulationRiskLevel = 'low' | 'medium' | 'high';

export interface SimulateSwapOutput {
    quote: QuoteResponseDto;
    swap: SwapResponseDto | null;
    summary: {
        routeId: string;
        riskLevel: SimulationRiskLevel;
        reasons: string[];
        totalCostUsd: number;
        expectedOutputAmount: string;
        expectedOutputMinAmount: string;
        expectedOutputUsd: number | null;
        estimatedGasUsd: number | null;
        durationInMinutes: number;
        priceImpact: number | null;
        slippage: number;
    };
}

export interface SwapResponseDto {
    quote: SwapRequestDto;
    estimate: EstimatesDto;
    fees: FeesDto;
    transaction: TransactionDto;
    uniqueInfo?: UniqueInfoDto;
    warnings: ErrorDto[];
    routing: RoutingDto[];
    providerType: CrossChainTradeType | OnChainTradeType;
    swapType: SwapType;
    useRubicContract: boolean;
}

export type TradeStatus =
    | 'PENDING'
    | 'LONG_PENDING'
    | 'REVERT'
    | 'REVERTED'
    | 'FAIL'
    | 'READY_TO_CLAIM'
    | 'SUCCESS'
    | 'NOT_FOUND'
    | 'INDETERMINATE'
    | 'WAITING_FOR_TRUSTLINE'
    | 'WAITING_FOR_REFUND_TRUSTLINE';

export interface StatusResponseDto {
    status: TradeStatus;
    destinationTxHash: string | null;
    destinationNetworkTitle: string | null;
    destinationNetworkChainId: number | null;
}

export interface SignedTxResponseDto {
    blockchain: BlockchainName;
    fromAddress: string;
    signedTransaction: string;
}

export interface BroadcastTxResponseDto {
    blockchain: BlockchainName;
    txHash: string;
}

export interface TokenBalanceDto {
    address: string;
    balance: string;
    decimals: number;
    name: string;
    symbol: string;
}

export interface ChainBalancesDto {
    blockchain: BlockchainName;
    tokens: TokenBalanceDto[];
}

export interface GetBalancesResponseDto {
    balances: ChainBalancesDto[];
}
