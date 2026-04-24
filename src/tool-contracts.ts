import { BLOCKCHAIN_NAME, CROSS_CHAIN_TRADE_TYPE, ON_CHAIN_TRADE_TYPE } from '@cryptorubic/core';
import { z } from 'zod';

import { config } from './config.js';

const blockchain = z.enum(BLOCKCHAIN_NAME).describe('Blockchain value from BLOCKCHAIN_NAME enum, for example ETHEREUM or POLYGON.');

const provider = z.union([z.enum(CROSS_CHAIN_TRADE_TYPE), z.enum(ON_CHAIN_TRADE_TYPE)]);
const hasWalletPrivateKey = Boolean(config.walletPrivateKey);

const tokenAddress = z
    .string()
    .min(1)
    .describe(
        'Token contract address on the selected blockchain. For native chain currency use the zero address 0x0000000000000000000000000000000000000000 (Rubic canonical form).'
    );

export const quoteRoutesInputSchema = {
    routeMode: z.enum(['all', 'best']).optional().describe('Whether to return only best route or all routes.'),
    srcTokenBlockchain: blockchain,
    srcTokenAddress: tokenAddress,
    srcTokenAmount: z.string().describe('Source amount as decimal string.'),
    dstTokenBlockchain: blockchain,
    dstTokenAddress: tokenAddress,
    fromAddress: z.string().optional().describe('Wallet address to send funds from.'),
    receiver: z.string().optional().describe('Receiver address on destination chain.'),
    nativeBlacklist: z.array(provider).optional().describe('Optional list of providers to exclude.'),
    preferredProvider: provider.optional().describe('Optional provider to prioritize during routing.'),
    showDangerousRoutes: z.boolean().optional().describe('Include dangerous routes if true.'),
    showFailedRoutes: z.boolean().optional().describe('Include failed routes if true.'),
    timeout: z.number().int().optional().describe('Calculation timeout in seconds.')
};

export const buildSwapTxInputSchema = {
    id: z.string().describe('Route id returned by rubic_quote_routes.'),
    srcTokenBlockchain: blockchain,
    srcTokenAddress: tokenAddress,
    srcTokenAmount: z.string().describe('Source amount as decimal string.'),
    dstTokenBlockchain: blockchain,
    dstTokenAddress: tokenAddress,
    fromAddress: hasWalletPrivateKey
        ? z.string().optional().describe('Source sender wallet address (optional when WALLET_PRIVATE_KEY is configured).')
        : z.string().describe('Source sender wallet address (required).'),
    receiver: hasWalletPrivateKey
        ? z.string().optional().describe('Destination receiver wallet address (optional when WALLET_PRIVATE_KEY is configured).')
        : z.string().describe('Destination receiver wallet address (required).'),
    refundAddress: z.string().optional().describe('Optional refund address for deposit-based routes.'),
    enableChecks: z.boolean().optional().describe('Enable gas and allowance checks before building tx.'),
    signature: z.string().optional().describe('Optional wallet signature for auth-enabled providers.')
};

export const trackStatusInputSchema = {
    id: z.string().optional().describe('Rubic route id from swap response.'),
    srcTxHash: z.string().optional().describe('Source blockchain transaction hash.')
};

const evmTransactionSchema = z.looseObject({
    to: z.string().optional().describe('Target contract or receiver address.'),
    data: z.string().optional().describe('Encoded calldata.'),
    value: z.string().optional().describe('Native value in wei as decimal string.'),
    gas: z.string().optional().describe('Gas limit in wei as decimal string.'),
    gasPrice: z.string().optional().describe('Legacy gas price in wei as decimal string.'),
    maxFeePerGas: z.string().optional().describe('EIP-1559 max fee per gas in wei as decimal string.'),
    maxPriorityFeePerGas: z.string().optional().describe('EIP-1559 max priority fee per gas in wei as decimal string.'),
    nonce: z.number().int().nonnegative().optional().describe('Optional explicit nonce.'),
    chainId: z.number().int().positive().optional().describe('Optional explicit chain id override.')
});

export const signTxInputSchema = {
    blockchain: blockchain.describe('EVM blockchain from BLOCKCHAIN_NAME enum.'),
    fromAddress: z.string().optional().describe('Optional sender address for key ownership check.'),
    transaction: evmTransactionSchema.describe('Transaction payload returned by rubic_build_swap_tx.')
};

export const broadcastTxInputSchema = {
    blockchain: blockchain.describe('EVM blockchain from BLOCKCHAIN_NAME enum.'),
    signedTransaction: z.string().describe('Raw signed transaction hex returned by rubic_sign_tx.')
};

export const quoteSwapSignBroadcastInputSchema = {
    ...quoteRoutesInputSchema,
    selectedRouteId: z.string().optional().describe('Optional explicit route id from rubic_quote_routes.'),
    refundAddress: z.string().optional().describe('Optional refund address for deposit-based routes.'),
    enableChecks: z.boolean().optional().describe('Enable gas and allowance checks before building tx.'),
    signature: z.string().optional().describe('Optional wallet signature for auth-enabled providers.')
};

export const quoteRoutesValidationSchema = z.looseObject(quoteRoutesInputSchema);
export const buildSwapTxValidationSchema = z.looseObject(buildSwapTxInputSchema);
export const trackStatusValidationSchema = z.looseObject(trackStatusInputSchema).superRefine((value, ctx) => {
    if (!value.id && !value.srcTxHash) {
        ctx.addIssue({
            code: 'custom',
            message: 'Either id or srcTxHash is required.'
        });
    }
});
export const signTxValidationSchema = z.looseObject(signTxInputSchema);
export const broadcastTxValidationSchema = z.looseObject(broadcastTxInputSchema);
export const quoteSwapSignBroadcastValidationSchema = z.looseObject(quoteSwapSignBroadcastInputSchema);

export type QuoteRoutesValidatedInput = z.infer<typeof quoteRoutesValidationSchema>;
export type BuildSwapTxValidatedInput = z.infer<typeof buildSwapTxValidationSchema>;
export type TrackStatusValidatedInput = z.infer<typeof trackStatusValidationSchema>;
export type SignTxValidatedInput = z.infer<typeof signTxValidationSchema>;
export type BroadcastTxValidatedInput = z.infer<typeof broadcastTxValidationSchema>;
export type QuoteSwapSignBroadcastValidatedInput = z.infer<typeof quoteSwapSignBroadcastValidationSchema>;
