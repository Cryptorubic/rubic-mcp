# Rubic MCP Server

## CRITICAL: Rubic is a route aggregator

Rubic is a **swap routing and aggregation engine** for same-chain and cross-chain swaps.
This MCP server provides a complete flow to:

- discover supported chains and tokens
- get swap routes and pick the best one (or inspect all routes)
- build transaction data for a selected route
- optionally sign and broadcast transactions with server-side wallet
- track cross-chain swap status

## Security

This server is non-custodial. Private keys are never transmitted — signing happens
locally in-process via viem. The Rubic API receives swap parameters and returns
calldata; it never touches keys. Without `EVM_WALLET_PRIVATE_KEY`, the server runs
in read-only mode (quotes, search, chain discovery only).

## Workflow

### 1. Getting a quote (no wallet required)

1. **Resolve chains**: call `rubic_get_supported_chains`.
2. **Find tokens**: call `rubic_search_tokens` by symbol/name/address.
3. **Get routes**: call `rubic_quote_routes`.
   - Use `routeMode: "best"` for one best route.
   - Use `routeMode: "all"` to inspect candidates.

### 2. Executing the swap

If `EVM_WALLET_PRIVATE_KEY` is configured (server wallet available):

4. **Recommended one-call flow**: call `rubic_quote_swap_sign_and_broadcast_tx`.
   - This executes quote -> build swap tx -> sign -> broadcast.
5. **Step-by-step flow** (if you need inspection):
   - `rubic_quote_routes`
   - `rubic_build_swap_tx`
   - `rubic_sign_and_broadcast_tx` (or `rubic_sign_tx` -> `rubic_broadcast_tx`)
6. **Browser fallback**: call `rubic_get_swap_url` only when user asks to review in UI.

If `EVM_WALLET_PRIVATE_KEY` is not configured:

4. **Build unsigned tx data**: call `rubic_build_swap_tx` with explicit `fromAddress` and `receiver`.
5. **Share browser execution link**: call `rubic_get_swap_url` after showing quote/routes.
6. **External signing path**: user signs externally, then you can broadcast via `rubic_broadcast_tx` if they provide a raw signed tx.

### 3. Tracking swap status

- For tracking swap status, call `rubic_track_status` with:
  - `id` (Rubic route/trade id), and/or
  - `srcTxHash` (source transaction hash).
- Prefer periodic polling until terminal status is reached.

### 4. Supported chains

- `rubic_get_supported_chains` returns chain names and chain IDs from Rubic core.
- Use these values directly in `srcTokenBlockchain` and `dstTokenBlockchain` fields.

## Amount and address conventions

- `srcTokenAmount` is a **human-readable decimal string** (for example `"1.5"`).
- For native chain currency, use the Rubic canonical zero address:
  - `0x0000000000000000000000000000000000000000`
- Gas/value fields inside EVM transaction payloads are wei-denominated strings (returned by tx builders).

## Tools reference

Tools are split into **read-only** (work without a key) and **execution**
(require `EVM_WALLET_PRIVATE_KEY`). In hosted mode, only read-only tools
are available.

| Tool | Requires `EVM_WALLET_PRIVATE_KEY` | Description |
|------|-------------------------------|-------------|
| `rubic_get_instructions` | No | Returns this guide |
| `rubic_get_supported_chains` | No | Returns all supported blockchains and chain IDs |
| `rubic_search_tokens` | No | Search tokens by name, symbol, or address |
| `rubic_quote_routes` | No | Calculate swap routes (best or all) |
| `rubic_build_swap_tx` | No* | Build executable swap transaction data from route id |
| `rubic_sign_tx` | Yes | Sign an EVM transaction with server wallet |
| `rubic_broadcast_tx` | No | Broadcast raw signed EVM transaction |
| `rubic_sign_and_broadcast_tx` | Yes | Sign and broadcast in one call |
| `rubic_quote_swap_sign_and_broadcast_tx` | Yes | All-in-one quote -> build -> sign -> broadcast |
| `rubic_track_status` | No | Track cross-chain trade status |
| `rubic_get_swap_url` | No | Generate pre-filled Rubic swap URL |

\* `rubic_build_swap_tx` works without `EVM_WALLET_PRIVATE_KEY`, but then `fromAddress` and `receiver` are required.

## Reading route responses

- Route responses contain route identifiers (`id`) used by `rubic_build_swap_tx`.
- If using all-in-one flow, `selectedRouteId` is optional; best route is used by default.
- For explicit route control, pass `selectedRouteId`.

## What this server does NOT do

- Does not custody private keys — signing is local, opt-in, in-process only.
- Does not sign non-EVM transactions (Solana, TRON, TON, Bitcoin) —
  use `rubic_build_swap_tx` + external signing, or `rubic_get_swap_url`.
- Does not execute limit orders or DCA — market swaps only.
- Does not simulate transactions on-chain — use `rubic_quote_routes` for estimates.
- Does not manage ERC-20 approvals — check `approvalAddress` in build response.
- Does not provide wallet balances — use a separate balance tool.
- Does not guarantee execution price — quotes are estimates subject to slippage.

## Common mistakes to avoid

1. **Skipping token/chain validation**: always resolve chain and token context first.
2. **Forgetting required addresses**: without `EVM_WALLET_PRIVATE_KEY`, pass both `fromAddress` and `receiver`.
3. **Mixing amount formats**: keep `srcTokenAmount` human-readable decimal string.
4. **Using wrong native token address**: for native token use Rubic zero address.

## Tips

- Start with `rubic_quote_routes` to present best execution options.
- Prefer `rubic_quote_swap_sign_and_broadcast_tx` when server wallet is configured.
- Use step-by-step flow when user needs transaction transparency or external signing.
- Provide `rubic_get_swap_url` as browser fallback, especially when server wallet is unavailable.

## Error Codes

| Code | Meaning |
|------|---------|
| `QUOTE_ROUTES_FAILED` | Rubic API could not calculate any route for the given pair |
| `ROUTE_ID_NOT_FOUND` | Route id could not be extracted from quote response |
| `BUILD_SWAP_TX_FAILED` | Transaction construction failed for the selected route |
| `SIGN_TX_FAILED` | Transaction signing failed (key mismatch, invalid tx) |
| `BROADCAST_TX_FAILED` | Signed transaction rejected by the network |
| `WALLET_NOT_CONFIGURED` | Tool requires EVM_WALLET_PRIVATE_KEY but it is not set |
| `TOOL_TIMEOUT` | Tool execution exceeded configured timeout |
| `HTTP_400` | Input validation failed |
| `HTTP_NETWORK` | Network request to Rubic API failed |
| `RUBIC_<N>` | Rubic API business error (code forwarded from API response) |
| `INTERNAL_ERROR` | Unexpected server error |
