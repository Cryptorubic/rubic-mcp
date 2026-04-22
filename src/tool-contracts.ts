import { BLOCKCHAIN_NAME, CROSS_CHAIN_TRADE_TYPE, ON_CHAIN_TRADE_TYPE } from '@cryptorubic/core';
import { z } from 'zod';

const blockchain = z.enum(BLOCKCHAIN_NAME).describe('Blockchain value from BLOCKCHAIN_NAME enum, for example ETHEREUM or POLYGON.');

const provider = z.union([z.enum(CROSS_CHAIN_TRADE_TYPE), z.enum(ON_CHAIN_TRADE_TYPE)]);

const tokenAddress = z
    .string()
    .min(1)
    .describe(
        'Token contract address on the selected blockchain. For native chain currency use the zero address 0x0000000000000000000000000000000000000000 (Rubic canonical form).'
    );

export const quoteRoutesInputSchema = {
    dstTokenAddress: tokenAddress,
    dstTokenBlockchain: blockchain,
    fromAddress: z.string().optional().describe('Wallet address to send funds from.'),
    nativeBlacklist: z.array(provider).optional().describe('Optional list of providers to exclude.'),
    preferredProvider: provider.optional().describe('Optional provider to prioritize during routing.'),
    receiver: z.string().optional().describe('Receiver address on destination chain.'),
    routeMode: z.enum(['all', 'best']).optional().describe('Whether to return only best route or all routes.'),
    showDangerousRoutes: z.boolean().optional().describe('Include dangerous routes if true.'),
    showFailedRoutes: z.boolean().optional().describe('Include failed routes if true.'),
    srcTokenAddress: tokenAddress,
    srcTokenAmount: z.string().describe('Source amount as decimal string.'),
    srcTokenBlockchain: blockchain,
    timeout: z.number().int().optional().describe('Calculation timeout in seconds.')
};

export const buildSwapTxInputSchema = {
    dstTokenAddress: tokenAddress,
    dstTokenBlockchain: blockchain,
    enableChecks: z.boolean().optional().describe('Enable gas and allowance checks before building tx.'),
    fromAddress: z.string().describe('Wallet address that signs and sends source tx.'),
    id: z.string().describe('Route id returned by rubic_quote_routes.'),
    receiver: z.string().describe('Receiver address on destination chain.'),
    refundAddress: z.string().optional().describe('Optional refund address for deposit-based routes.'),
    signature: z.string().optional().describe('Optional wallet signature for auth-enabled providers.'),
    srcTokenAddress: tokenAddress,
    srcTokenAmount: z.string().describe('Source amount as decimal string.'),
    srcTokenBlockchain: blockchain
};

export const trackStatusInputSchema = {
    id: z.string().optional().describe('Rubic route id from swap response.'),
    srcTxHash: z.string().optional().describe('Source blockchain transaction hash.')
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

export type QuoteRoutesValidatedInput = z.infer<typeof quoteRoutesValidationSchema>;
export type BuildSwapTxValidatedInput = z.infer<typeof buildSwapTxValidationSchema>;
export type TrackStatusValidatedInput = z.infer<typeof trackStatusValidationSchema>;
