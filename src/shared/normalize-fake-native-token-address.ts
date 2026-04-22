import { BlockchainName, BlockchainsInfo } from '@cryptorubic/core';
import { Web3Pure } from '@cryptorubic/web3';

const FAKE_NATIVE_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

const normalizeAddress = (address: string): string => address.toLowerCase();

/**
 * Maps 1inch-style fake native token address to Rubic canonical native address.
 */
export function normalizeFakeNativeTokenAddress(address: string, blockchain: BlockchainName): string {
    if (normalizeAddress(address) !== FAKE_NATIVE_ADDRESS) {
        return address;
    }

    const chainType = BlockchainsInfo.getChainType(blockchain);
    return Web3Pure.getNativeTokenAddress(chainType);
}

export function normalizeTokenAddresses<
    T extends {
        srcTokenBlockchain: BlockchainName;
        srcTokenAddress: string;
        dstTokenBlockchain: BlockchainName;
        dstTokenAddress: string;
    }
>(request: T): T {
    const next = { ...request };
    const srcBc = next.srcTokenBlockchain;
    const dstBc = next.dstTokenBlockchain;

    next.srcTokenAddress = normalizeFakeNativeTokenAddress(next.srcTokenAddress, srcBc);
    next.dstTokenAddress = normalizeFakeNativeTokenAddress(next.dstTokenAddress, dstBc);

    return next;
}
