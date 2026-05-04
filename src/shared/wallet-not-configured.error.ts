export class WalletNotConfiguredError extends Error {
    constructor() {
        super('EVM_WALLET_PRIVATE_KEY is not configured. Add it to .env to enable signing tools.');
        this.name = 'WalletNotConfiguredError';
    }
}
