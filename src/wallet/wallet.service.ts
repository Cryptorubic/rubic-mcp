import { BlockchainName, BlockchainsInfo, EvmBlockchainName } from '@cryptorubic/core';
import { viemBlockchainMapping } from '@cryptorubic/web3';
import { Chain, createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

import { BroadcastTxValidatedInput, SignTxValidatedInput } from '../tool-contracts.js';
import { BroadcastTxResponseDto, SignedTxResponseDto } from '../types/rubic-api.dto.js';

type Hex = `0x${string}`;
type FeeParams =
    | { kind: 'legacy'; gasPrice: bigint }
    | { kind: 'eip1559'; maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }
    | { kind: 'none' };

export class WalletService {
    constructor(private readonly walletPrivateKey?: Hex) {}

    public async signTransaction(input: SignTxValidatedInput): Promise<SignedTxResponseDto> {
        const privateKey = this.getPrivateKey();
        this.ensureEvmBlockchain(input.blockchain);

        const account = privateKeyToAccount(privateKey);
        const chain = this.getEvmChain(input.blockchain);
        const rpcUrl = this.getHttpRpcUrl(chain);
        const normalizedFromAddress = input.fromAddress?.toLowerCase();

        if (normalizedFromAddress && normalizedFromAddress !== account.address.toLowerCase()) {
            throw new Error('fromAddress does not match WALLET_PRIVATE_KEY.');
        }

        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl)
        });
        const walletClient = createWalletClient({
            account,
            chain,
            transport: http(rpcUrl)
        });

        if (input.transaction.chainId !== undefined && input.transaction.chainId !== chain.id) {
            throw new Error(
                `transaction.chainId (${input.transaction.chainId}) does not match ${input.blockchain} chain id (${chain.id}).`
            );
        }

        const value = this.parseBigInt(input.transaction.value, 'transaction.value');
        const nonce = input.transaction.nonce ?? (await publicClient.getTransactionCount({ address: account.address }));
        const gas =
            input.transaction.gas !== undefined
                ? this.parseBigInt(input.transaction.gas, 'transaction.gas')
                : await publicClient.estimateGas({
                      account: account.address,
                      ...(input.transaction.data ? { data: input.transaction.data as Hex } : {}),
                      ...(input.transaction.to ? { to: input.transaction.to as Hex } : {}),
                      ...(value !== undefined ? { value } : {})
                  });
        const feeParams = await this.resolveFeeParams(publicClient, input.transaction);
        const baseSignParams = {
            account,
            chain,
            nonce,
            ...(gas !== undefined ? { gas } : {}),
            ...(input.transaction.data ? { data: input.transaction.data as Hex } : {}),
            ...(input.transaction.to ? { to: input.transaction.to as Hex } : {}),
            ...(value !== undefined ? { value } : {})
        };
        const signedTransaction =
            feeParams.kind === 'legacy'
                ? await walletClient.signTransaction({
                      ...baseSignParams,
                      gasPrice: feeParams.gasPrice
                  })
                : feeParams.kind === 'eip1559'
                  ? await walletClient.signTransaction({
                        ...baseSignParams,
                        ...(feeParams.maxFeePerGas !== undefined ? { maxFeePerGas: feeParams.maxFeePerGas } : {}),
                        ...(feeParams.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: feeParams.maxPriorityFeePerGas } : {})
                    })
                  : await walletClient.signTransaction(baseSignParams);

        return {
            blockchain: input.blockchain,
            fromAddress: account.address,
            signedTransaction
        };
    }

    public async broadcastTransaction(input: BroadcastTxValidatedInput): Promise<BroadcastTxResponseDto> {
        this.ensureEvmBlockchain(input.blockchain);

        const chain = this.getEvmChain(input.blockchain);
        const rpcUrl = this.getHttpRpcUrl(chain);
        const publicClient = createPublicClient({
            chain,
            transport: http(rpcUrl)
        });
        const signedTransaction = input.signedTransaction.startsWith('0x')
            ? (input.signedTransaction as Hex)
            : (`0x${input.signedTransaction}` as Hex);
        const txHash = await publicClient.sendRawTransaction({
            serializedTransaction: signedTransaction
        });

        return {
            blockchain: input.blockchain,
            txHash
        };
    }

    private getPrivateKey(): Hex {
        if (!this.walletPrivateKey) {
            throw new Error('WALLET_PRIVATE_KEY is not configured. Add it to .env to enable signing tools.');
        }

        return this.walletPrivateKey;
    }

    private ensureEvmBlockchain(blockchain: BlockchainName): asserts blockchain is EvmBlockchainName {
        if (!BlockchainsInfo.isEvmBlockchainName(blockchain)) {
            throw new Error(`Blockchain ${blockchain} is not supported by private-key EVM signing.`);
        }
    }

    private getEvmChain(blockchain: EvmBlockchainName): Chain {
        const chain = viemBlockchainMapping[blockchain];

        if (!chain) {
            throw new Error(`No EVM chain configuration found for blockchain ${blockchain}.`);
        }

        return chain as Chain;
    }

    private getHttpRpcUrl(chain: Chain): string {
        const rpcUrl = chain.rpcUrls.default.http?.find((url) => /^https?:\/\//.test(url));

        if (!rpcUrl) {
            throw new Error(`No HTTP RPC URL found for blockchain ${chain.name}.`);
        }

        return rpcUrl;
    }

    private parseBigInt(value: string | undefined, fieldName: string): bigint | undefined {
        if (value === undefined) {
            return undefined;
        }

        try {
            return BigInt(value);
        } catch {
            throw new Error(`${fieldName} must be a valid integer string.`);
        }
    }

    private async resolveFeeParams(
        publicClient: ReturnType<typeof createPublicClient>,
        tx: SignTxValidatedInput['transaction']
    ): Promise<FeeParams> {
        const gasPrice = this.parseBigInt(tx.gasPrice, 'transaction.gasPrice');
        const maxFeePerGas = this.parseBigInt(tx.maxFeePerGas, 'transaction.maxFeePerGas');
        const maxPriorityFeePerGas = this.parseBigInt(tx.maxPriorityFeePerGas, 'transaction.maxPriorityFeePerGas');

        if (gasPrice !== undefined) {
            return { kind: 'legacy', gasPrice };
        }

        if (maxFeePerGas !== undefined || maxPriorityFeePerGas !== undefined) {
            const estimated = await publicClient.estimateFeesPerGas();
            return {
                kind: 'eip1559',
                maxFeePerGas: maxFeePerGas ?? estimated.maxFeePerGas ?? undefined,
                maxPriorityFeePerGas: maxPriorityFeePerGas ?? estimated.maxPriorityFeePerGas ?? undefined
            };
        }

        const estimated = await publicClient.estimateFeesPerGas();

        if (estimated.maxFeePerGas !== undefined || estimated.maxPriorityFeePerGas !== undefined) {
            return {
                kind: 'eip1559',
                ...(estimated.maxFeePerGas !== undefined ? { maxFeePerGas: estimated.maxFeePerGas } : {}),
                ...(estimated.maxPriorityFeePerGas !== undefined ? { maxPriorityFeePerGas: estimated.maxPriorityFeePerGas } : {})
            };
        }

        if (estimated.gasPrice !== undefined) {
            return {
                kind: 'legacy',
                gasPrice: estimated.gasPrice
            };
        }

        return {
            kind: 'none'
        };
    }
}
