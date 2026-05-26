import { BLOCKCHAIN_NAME, blockchainId, BlockchainsInfo, EvmBlockchainName } from '@cryptorubic/core';
import { viemBlockchainMapping } from '@cryptorubic/web3';
import { Address, Chain, createPublicClient, decodeFunctionResult, encodeFunctionData, parseAbi } from 'viem';

import tokens from '../data/tokens.json' with { type: 'json' };
import { RpcService } from '../services/rpc.service.js';
import { chunk } from '../shared/array-utils.js';
import { McpErrorMapper } from '../shared/error-mapper.js';
import { McpResultEnvelope } from '../shared/result-envelope.js';
import { McpValidationService } from '../shared/validation.service.js';
import { GetBalancesValidatedInput, getBalancesValidationSchema } from '../tool-contracts.js';
import { GetBalancesResponseDto } from '../types/api.dto.js';
import { WalletService } from '../wallet/wallet.service.js';

type TokenEntry = {
    c: number;
    s: string;
    n: string;
    a: string;
    d: number;
};

type TokenBalance = {
    symbol: string;
    name: string;
    address: string;
    balance: string;
    decimals: number;
};

const BATCH_SIZE = 300;
const CHAIN_TIMEOUT_MS = 15_000;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const DEFAULT_MULTICALL = '0xcA11bde05977b3631167028862bE2a173976CA11';
const TRY_AGGREGATE_ABI = parseAbi([
    'function tryAggregate(bool requireSuccess, (address, bytes)[] calls) view returns ((bool, bytes)[] returnData)'
]);
const ERC20_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

const MULTICALL_ADDRESSES: Record<number, Address> = {
    1: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    40: '0x53dC7535028e2fcaCa0d847AD108b9240C0801b1',
    56: '0xfF6FD90A470Aaa0c1B8A54681746b07AcdFedc9B',
    130: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    137: '0x275617327c958bD06b5D6b871E7f491D76113dd8',
    223: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    288: '0xaeD5b25BE1c3163c907a471082640450F928DDFE',
    324: '0x52192C3De01535a9Ad2743A5Fe4f774868103C20',
    388: '0x4c398CB4b7D4d31a54D254d8Aed09B9e8353E80E',
    1625: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    1868: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    2222: '0x30A62aA52Fa099C4B227869EB6aeaDEda054d121',
    2345: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    2741: '0xBf63C7944B1635c79a0f0eE7e07b1702837AD1F9',
    2818: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    4200: '0x45CFd6FB7999328F189aaD2739Fba4Be6C45E5bf',
    5000: '0xb55cc6B5B402437b66c13c0CEd0EF367aa7c26da',
    5165: '0xa385B1436fD2A6a1c6865E22c522A1aA40CaDCC6',
    9745: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    80094: '0xd8db4fb1fEf63045A443202d506Bcf30ef404160',
    1565: '0x7E06D0CD8D3fDDBB875345dF389d986f810A49F6',
    167000: '0x076f5925112b13a4D4c70fc83d9019f1854e4415',
    42161: '0x80c7dd17b01855a6d2347444a0fcc36136a314de',
    43114: '0x29b6603d17b9d8f021ecb8845b6fd06e1adf89de',
    747474: '0x6AEb9b27590387b8Fd0560C52f6B968C59C10Fab'
};

export class GetBalancesTool {
    public static readonly name = 'rubic_get_balances';

    constructor(
        private readonly errorMapper: McpErrorMapper,
        private readonly validationService: McpValidationService,
        private readonly rpcService: RpcService,
        private readonly walletService: WalletService
    ) {}

    public async execute(input: Record<string, unknown>, traceId: string): Promise<McpResultEnvelope<GetBalancesResponseDto>> {
        try {
            const validatedInput = this.validationService.validate<GetBalancesValidatedInput>(getBalancesValidationSchema, input);
            const walletAddress = validatedInput.address ?? this.walletService.getWalletAddress();

            if (!walletAddress) {
                throw new Error('Wallet address is required. Provide an EVM address or configure EVM_WALLET_PRIVATE_KEY.');
            }

            const allEvmChains = this.getSupportedEvmChains();
            const allowedChainIds = new Set(allEvmChains.map((chain) => chain.chainId));
            const chainIds = (
                validatedInput.chainIds?.length ? validatedInput.chainIds : allEvmChains.map((chain) => chain.chainId)
            ).filter((id) => allowedChainIds.has(id));

            const tokenIndex = this.buildTokenIndex();
            const chainNameById = new Map(allEvmChains.map((chain) => [chain.chainId, chain.blockchain]));

            const chainResults = await Promise.all(
                chainIds.map(async (chainId) =>
                    Promise.race([
                        this.fetchEvmChainBalances(
                            chainId,
                            walletAddress as Address,
                            tokenIndex.get(chainId) ?? [],
                            chainNameById.get(chainId)
                        ),
                        new Promise<null>((resolve) => {
                            setTimeout(() => resolve(null), CHAIN_TIMEOUT_MS);
                        })
                    ]).catch(() => null)
                )
            );

            const balances = chainResults.filter((result): result is NonNullable<typeof result> => result !== null);
            balances.sort((left, right) => right.tokens.length - left.tokens.length);

            const totalTokens = balances.reduce((sum, item) => sum + item.tokens.length, 0);
            const chainCount = balances.length;
            const summary = `Found ${totalTokens} token${totalTokens !== 1 ? 's' : ''} with non-zero balance across ${chainCount} chain${chainCount !== 1 ? 's' : ''}`;

            return {
                data: {
                    address: walletAddress,
                    balances,
                    summary
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

    private getSupportedEvmChains(): { chainId: number; blockchain: EvmBlockchainName }[] {
        return Object.values(BLOCKCHAIN_NAME)
            .filter((blockchain): blockchain is EvmBlockchainName => BlockchainsInfo.isEvmBlockchainName(blockchain))
            .map((blockchain) => ({
                blockchain,
                chainId: blockchainId[blockchain]
            }));
    }

    private buildTokenIndex(): Map<number, TokenEntry[]> {
        const tokenIndex = new Map<number, TokenEntry[]>();

        for (const token of tokens as TokenEntry[]) {
            if (!token.a || token.a.toLowerCase() === ZERO_ADDRESS) {
                continue;
            }

            const list = tokenIndex.get(token.c);
            if (list) {
                list.push(token);
            } else {
                tokenIndex.set(token.c, [token]);
            }
        }

        return tokenIndex;
    }

    private async fetchEvmChainBalances(
        chainId: number,
        walletAddress: Address,
        chainTokens: TokenEntry[],
        blockchainName?: EvmBlockchainName
    ): Promise<GetBalancesResponseDto['balances'][number] | null> {
        if (!blockchainName) {
            return null;
        }

        const chain = viemBlockchainMapping[blockchainName] as Chain | undefined;

        if (!chain) {
            return null;
        }

        const client = createPublicClient({
            chain,
            transport: this.rpcService.createHttpTransport(chain)
        });

        const balances: TokenBalance[] = [];

        try {
            const nativeBalance = await client.getBalance({ address: walletAddress });

            if (nativeBalance > 0n) {
                balances.push({
                    address: '',
                    balance: this.formatUnits(nativeBalance, chain.nativeCurrency.decimals),
                    decimals: chain.nativeCurrency.decimals,
                    name: chain.nativeCurrency.name,
                    symbol: chain.nativeCurrency.symbol
                });
            }
        } catch {
            return null;
        }

        if (chainTokens.length === 0) {
            return balances.length ? { blockchain: blockchainName, tokens: balances } : null;
        }

        const balanceOfData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [walletAddress]
        });
        const multicallAddress = (MULTICALL_ADDRESSES[chainId] ?? DEFAULT_MULTICALL) as Address;
        const batches = chunk(chainTokens, BATCH_SIZE);

        const tokenBatches = await Promise.all(
            batches.map(async (batch) => {
                try {
                    const calls = batch.map((token) => [token.a as Address, balanceOfData] as const);
                    const data = encodeFunctionData({
                        abi: TRY_AGGREGATE_ABI,
                        functionName: 'tryAggregate',
                        args: [false, calls]
                    });
                    const raw = await client.call({
                        data,
                        to: multicallAddress
                    });

                    if (!raw.data) {
                        return [];
                    }

                    const decoded = decodeFunctionResult({
                        abi: TRY_AGGREGATE_ABI,
                        data: raw.data,
                        functionName: 'tryAggregate'
                    }) as readonly [boolean, `0x${string}`][];
                    const found: TokenBalance[] = [];

                    for (let index = 0; index < decoded.length; index += 1) {
                        const [success, returnData] = decoded[index];

                        if (!success || !returnData || returnData === '0x' || returnData.length < 66) {
                            continue;
                        }

                        try {
                            const balance = BigInt(returnData);

                            if (balance > 0n) {
                                const token = batch[index];
                                found.push({
                                    address: token.a,
                                    balance: this.formatUnits(balance, token.d),
                                    decimals: token.d,
                                    name: token.n,
                                    symbol: token.s
                                });
                            }
                        } catch {
                            // Ignore malformed per-token response.
                        }
                    }

                    return found;
                } catch {
                    return [];
                }
            })
        );

        for (const batchBalances of tokenBatches) {
            balances.push(...batchBalances);
        }

        return balances.length ? { blockchain: blockchainName, tokens: balances } : null;
    }

    private formatUnits(value: bigint, decimals: number): string {
        if (value === 0n) {
            return '0';
        }

        if (decimals === 0) {
            return value.toString();
        }

        const asString = value.toString();

        if (asString.length <= decimals) {
            const fractional = asString.padStart(decimals, '0').replace(/0+$/, '');
            return fractional ? `0.${fractional}` : '0';
        }

        const integerPart = asString.slice(0, asString.length - decimals);
        const fractionalPart = asString.slice(asString.length - decimals).replace(/0+$/, '');
        return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
    }
}
