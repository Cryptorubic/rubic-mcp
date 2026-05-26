import { BLOCKCHAIN_NAME, blockchainId, BlockchainsInfo } from '@cryptorubic/core';
import { Chain, fallback, http, HttpTransportConfig } from 'viem';

import localRpcs from '../data/rpcs.json' with { type: 'json' };
import { chunk } from '../shared/array-utils.js';

type ChainlistEntry = {
    id: number;
    name: string;
    short: string;
    sym: string;
    gas: string;
    rpcs: string[];
};

type ChainRpcData = {
    chainId: number;
    name: string;
    shortName: string;
    chainSymbol: string;
    gasSymbol: string;
    rpcs: ValidatedRpc[];
    lastValidated: number;
};

type RawChainlistEntry = {
    chainId?: unknown;
    chain?: unknown;
    isTestnet?: boolean;
    name?: unknown;
    nativeCurrency?: unknown;
    rpc?: unknown;
    shortName?: unknown;
};

type JsonRpcErrorPayload = {
    error?: {
        code?: unknown;
        message?: unknown;
    };
};

export type ValidatedRpc = {
    latencyMs: number;
    url: string;
};

type RpcTransport = ReturnType<typeof http> | ReturnType<typeof fallback>;

const BLOCK_STALENESS_LIMIT_SECONDS = 20 * 60;
const CHAINLIST_TIMEOUT_MS = 30_000;
const CHAIN_PARALLEL = 5;
const DEFAULT_RPC_COUNT = 5;
const HTTP_TRANSPORT_TIMEOUT_MS = 10_000;
const MAX_RPCS_PER_CHAIN = 20;
const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const RPC_TIMEOUT_MS = 5_000;
const VALIDATION_BATCH_SIZE = 15;

const LOCAL_RPC_ENTRIES = localRpcs as unknown as ChainlistEntry[];

export class RpcService {
    private readonly chainRpcMap = new Map<number, ChainRpcData>();

    private readonly rotationIndexByChainId = new Map<number, number>();

    private allChainlistEntries: ChainlistEntry[] = [];

    private initialized = false;

    private localFallbackLoaded = false;

    private refreshTimer: ReturnType<typeof setInterval> | undefined;

    public init(): void {
        if (this.initialized) {
            return;
        }

        this.initialized = true;
        this.loadLocalFallback();
        this.refreshAll().catch((error) => console.error('[rpc-service] Initial refresh failed:', error));

        this.refreshTimer = setInterval(() => {
            this.refreshAll().catch((error) => console.error('[rpc-service] Periodic refresh failed:', error));
        }, REFRESH_INTERVAL_MS);
        this.refreshTimer.unref();
    }

    public createHttpTransport(chain: Chain, count = DEFAULT_RPC_COUNT): RpcTransport {
        const rpcUrls = this.getRpcUrls(chain.id, count, this.getChainRpcUrls(chain));

        if (rpcUrls.length === 0) {
            throw new Error(`No HTTP RPC URL found for blockchain ${chain.name}.`);
        }

        const transports = rpcUrls.map((url) =>
            http(url, {
                fetchFn: this.createTrackedFetch(chain.id, url),
                retryCount: 0,
                timeout: HTTP_TRANSPORT_TIMEOUT_MS
            })
        );

        if (transports.length === 1) {
            return transports[0];
        }

        return fallback(transports, {
            rank: false,
            retryCount: 0
        });
    }

    public getRpcUrls(chainId: number, count = DEFAULT_RPC_COUNT, fallbackUrls: string[] = []): string[] {
        this.loadLocalFallback();

        const data = this.chainRpcMap.get(chainId);
        const urls = this.uniqueRpcUrls([...(data?.rpcs.map((rpc) => rpc.url) ?? []), ...fallbackUrls]);

        if (urls.length <= 1) {
            return urls;
        }

        const startIndex = this.rotationIndexByChainId.get(chainId) ?? 0;
        this.rotationIndexByChainId.set(chainId, (startIndex + 1) % urls.length);

        return this.rotate(urls, startIndex).slice(0, count);
    }

    private loadLocalFallback(): void {
        if (this.localFallbackLoaded) {
            return;
        }

        this.localFallbackLoaded = true;
        this.allChainlistEntries = LOCAL_RPC_ENTRIES.map((entry) => this.normalizeEntry(entry)).filter(
            (entry): entry is ChainlistEntry => entry !== null
        );

        for (const entry of this.allChainlistEntries) {
            this.chainRpcMap.set(entry.id, {
                chainId: entry.id,
                chainSymbol: entry.sym,
                gasSymbol: entry.gas,
                lastValidated: 0,
                name: entry.name,
                rpcs: entry.rpcs.map((url) => ({ latencyMs: -1, url })),
                shortName: entry.short
            });
        }

        console.error(`[rpc-service] Loaded ${this.allChainlistEntries.length} chains from local DB`);
    }

    private async refreshAll(): Promise<void> {
        console.error('[rpc-service] Starting RPC refresh...');

        const supportedChainIds = this.getSupportedEvmChainIds();
        const localToValidate = this.allChainlistEntries.filter((entry) => supportedChainIds.has(entry.id));

        console.error(`[rpc-service] Validating RPCs for ${localToValidate.length} Rubic EVM chains...`);
        await this.validateEntries(localToValidate);
        console.error(`[rpc-service] Local validation done: ${this.getValidatedRpcCount()} working RPCs`);

        const freshEntries = await this.fetchChainlistRpcs();

        if (freshEntries) {
            this.allChainlistEntries = freshEntries;

            const freshToValidate = freshEntries.filter((entry) => supportedChainIds.has(entry.id));
            console.error(
                `[rpc-service] Fetched ${freshEntries.length} chains from chainlist.org, validating ${freshToValidate.length}...`
            );
            await this.validateEntries(freshToValidate);
        }

        console.error(`[rpc-service] Refresh complete: ${this.chainRpcMap.size} chains, ${this.getValidatedRpcCount()} working RPCs`);
    }

    private async fetchChainlistRpcs(): Promise<ChainlistEntry[] | null> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), CHAINLIST_TIMEOUT_MS);

        try {
            const response = await fetch('https://chainlist.org/rpcs.json', {
                signal: controller.signal
            });

            if (!response.ok) {
                return null;
            }

            const raw = (await response.json()) as RawChainlistEntry[];
            return raw
                .filter((entry) => entry.isTestnet !== true)
                .map((entry) => this.toChainlistEntry(entry))
                .filter((entry): entry is ChainlistEntry => entry !== null);
        } catch {
            console.error('[rpc-service] Failed to fetch from chainlist.org, using local fallback');
            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    private async validateEntries(entries: ChainlistEntry[]): Promise<void> {
        const batches = chunk(entries, CHAIN_PARALLEL);

        for (const batch of batches) {
            await Promise.all(
                batch.map(async (entry) => {
                    const validated = await this.validateChainRpcs(entry.rpcs);
                    const existing = this.chainRpcMap.get(entry.id);

                    if (validated.length === 0 && existing) {
                        return;
                    }

                    this.chainRpcMap.set(entry.id, {
                        chainId: entry.id,
                        chainSymbol: entry.sym,
                        gasSymbol: entry.gas,
                        lastValidated: Date.now(),
                        name: entry.name,
                        rpcs: validated.length > 0 ? validated : (existing?.rpcs ?? []),
                        shortName: entry.short
                    });
                })
            );
        }
    }

    private async validateChainRpcs(rpcs: string[]): Promise<ValidatedRpc[]> {
        const batches = chunk(rpcs.slice(0, MAX_RPCS_PER_CHAIN), VALIDATION_BATCH_SIZE);
        const goodRpcs: ValidatedRpc[] = [];

        for (const batch of batches) {
            const results = await Promise.all(
                batch.map(async (url) => {
                    const result = await this.validateRpc(url);
                    return { url, ...result };
                })
            );

            for (const result of results) {
                if (result.ok) {
                    goodRpcs.push({
                        latencyMs: result.latencyMs,
                        url: result.url
                    });
                }
            }
        }

        goodRpcs.sort((left, right) => left.latencyMs - right.latencyMs);
        return goodRpcs;
    }

    private async validateRpc(url: string): Promise<{ latencyMs: number; ok: boolean }> {
        const startedAt = Date.now();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                body: JSON.stringify({
                    id: 1,
                    jsonrpc: '2.0',
                    method: 'eth_getBlockByNumber',
                    params: ['latest', false]
                }),
                headers: { 'Content-Type': 'application/json' },
                method: 'POST',
                signal: controller.signal
            });
            const latencyMs = Date.now() - startedAt;

            if (!response.ok) {
                return { latencyMs, ok: false };
            }

            const data = (await response.json()) as {
                result?: { timestamp?: string };
            };
            const timestamp = data.result?.timestamp;

            if (!timestamp) {
                return { latencyMs, ok: false };
            }

            const blockTime = Number.parseInt(timestamp, 16);
            const nowSeconds = Math.floor(Date.now() / 1000);

            if (nowSeconds - blockTime > BLOCK_STALENESS_LIMIT_SECONDS) {
                return { latencyMs, ok: false };
            }

            return { latencyMs, ok: true };
        } catch {
            return {
                latencyMs: Date.now() - startedAt,
                ok: false
            };
        } finally {
            clearTimeout(timeout);
        }
    }

    private createTrackedFetch(chainId: number, url: string): NonNullable<HttpTransportConfig['fetchFn']> {
        return async (input, init) => {
            const startedAt = Date.now();

            try {
                const response = await fetch(input, init);
                const latencyMs = Date.now() - startedAt;

                if (response.ok) {
                    void this.trackSuccessfulResponse(chainId, url, response.clone(), latencyMs);
                } else if (this.isRetryableStatus(response.status)) {
                    this.penalizeRpc(chainId, url);
                }

                return response;
            } catch (error) {
                this.penalizeRpc(chainId, url);
                throw error;
            }
        };
    }

    private async trackSuccessfulResponse(chainId: number, url: string, response: Response, latencyMs: number): Promise<void> {
        try {
            const payload = (await response.json()) as JsonRpcErrorPayload | JsonRpcErrorPayload[];

            if (this.hasRetryableRpcError(payload)) {
                this.penalizeRpc(chainId, url);
                return;
            }
        } catch {}

        this.rewardRpc(chainId, url, latencyMs);
    }

    private hasRetryableRpcError(payload: JsonRpcErrorPayload | JsonRpcErrorPayload[]): boolean {
        const responses = Array.isArray(payload) ? payload : [payload];

        return responses.some((response) => {
            const { error } = response;

            if (!error) {
                return false;
            }

            return this.isRetryableRpcErrorCode(error.code) || this.isRetryableRpcErrorMessage(error.message);
        });
    }

    private isRetryableRpcErrorCode(code: unknown): boolean {
        return typeof code === 'number' && (code === 429 || code === -32005);
    }

    private isRetryableRpcErrorMessage(message: unknown): boolean {
        if (typeof message !== 'string') {
            return false;
        }

        const normalized = message.toLowerCase();

        return (
            normalized.includes('rate limit') ||
            normalized.includes('too many requests') ||
            normalized.includes('limit exceeded') ||
            normalized.includes('request count exceeded') ||
            normalized.includes('throttle') ||
            normalized.includes('temporarily unavailable')
        );
    }

    private rewardRpc(chainId: number, url: string, latencyMs: number): void {
        const rpc = this.getTrackedRpc(chainId, url);

        if (!rpc) {
            return;
        }

        rpc.latencyMs = rpc.latencyMs <= 0 ? latencyMs : Math.round(rpc.latencyMs * 0.3 + latencyMs * 0.7);
        this.sortRpcs(chainId);
    }

    private penalizeRpc(chainId: number, url: string): void {
        const rpc = this.getTrackedRpc(chainId, url);

        if (!rpc) {
            return;
        }

        rpc.latencyMs = Math.min(30_000, Math.max(10_000, (rpc.latencyMs > 0 ? rpc.latencyMs : 5_000) * 2));
        this.sortRpcs(chainId);
    }

    private sortRpcs(chainId: number): void {
        const data = this.chainRpcMap.get(chainId);

        if (!data) {
            return;
        }

        data.rpcs.sort((left, right) => this.getSortLatency(left) - this.getSortLatency(right));
    }

    private getTrackedRpc(chainId: number, url: string): ValidatedRpc | undefined {
        return this.chainRpcMap.get(chainId)?.rpcs.find((rpc) => rpc.url === url);
    }

    private getSortLatency(rpc: ValidatedRpc): number {
        return rpc.latencyMs < 0 ? 4_999 : rpc.latencyMs;
    }

    private getSupportedEvmChainIds(): Set<number> {
        return new Set(
            Object.values(BLOCKCHAIN_NAME)
                .filter((blockchain) => BlockchainsInfo.isEvmBlockchainName(blockchain))
                .map((blockchain) => blockchainId[blockchain])
        );
    }

    private getValidatedRpcCount(): number {
        return Array.from(this.chainRpcMap.values()).reduce(
            (total, chainData) => total + chainData.rpcs.filter((rpc) => rpc.latencyMs > 0).length,
            0
        );
    }

    private getChainRpcUrls(chain: Chain): string[] {
        return this.uniqueRpcUrls(Object.values(chain.rpcUrls).flatMap((rpcUrls) => [...rpcUrls.http]));
    }

    private toChainlistEntry(entry: RawChainlistEntry): ChainlistEntry | null {
        const rpcs = this.getRawRpcUrls(entry.rpc);

        if (typeof entry.chainId !== 'number' || typeof entry.name !== 'string' || rpcs.length === 0) {
            return null;
        }

        const nativeCurrency = this.getNativeCurrency(entry.nativeCurrency);

        return {
            gas: typeof nativeCurrency?.symbol === 'string' ? nativeCurrency.symbol : '',
            id: entry.chainId,
            name: entry.name,
            rpcs,
            short: typeof entry.shortName === 'string' ? entry.shortName : '',
            sym: typeof entry.chain === 'string' ? entry.chain : ''
        };
    }

    private normalizeEntry(entry: ChainlistEntry): ChainlistEntry | null {
        const rpcs = this.uniqueRpcUrls(entry.rpcs);

        if (!Number.isFinite(entry.id) || !entry.name || rpcs.length === 0) {
            return null;
        }

        return {
            ...entry,
            rpcs
        };
    }

    private getRawRpcUrls(rpcEntries: unknown): string[] {
        if (!Array.isArray(rpcEntries)) {
            return [];
        }

        return this.uniqueRpcUrls(
            rpcEntries
                .map((rpc) => {
                    if (typeof rpc === 'string') {
                        return rpc;
                    }

                    if (typeof rpc === 'object' && rpc !== null && 'url' in rpc) {
                        const { url } = rpc as { url?: unknown };
                        return typeof url === 'string' ? url : '';
                    }

                    return '';
                })
                .filter((url) => url.length > 0)
        );
    }

    private getNativeCurrency(nativeCurrency: unknown): { symbol?: unknown } | undefined {
        return typeof nativeCurrency === 'object' && nativeCurrency !== null ? (nativeCurrency as { symbol?: unknown }) : undefined;
    }

    private isRetryableStatus(status: number): boolean {
        return status === 429 || status >= 500;
    }

    private uniqueRpcUrls(urls: string[]): string[] {
        const seen = new Set<string>();
        const result: string[] = [];

        for (const rawUrl of urls) {
            const url = rawUrl.trim();

            if (!this.isUsableRpcUrl(url) || seen.has(url)) {
                continue;
            }

            seen.add(url);
            result.push(url);
        }

        return result;
    }

    private isUsableRpcUrl(url: string): boolean {
        const upperUrl = url.toUpperCase();

        return (
            /^https?:\/\//.test(url) &&
            !url.includes('${') &&
            !url.includes('{') &&
            !upperUrl.includes('API_KEY') &&
            !upperUrl.includes('INFURA') &&
            !upperUrl.includes('ALCHEMY')
        );
    }

    private rotate<T>(items: T[], startIndex: number): T[] {
        return [...items.slice(startIndex), ...items.slice(0, startIndex)];
    }
}
