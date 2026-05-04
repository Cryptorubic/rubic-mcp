# Rubic MCP Server

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-8A2BE2)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-Hub-2496ED?logo=docker&logoColor=white)](https://hub.docker.com/r/rubicfinance/rubic-mcp)

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server for [Rubic](https://rubic.exchange) that enables AI agents to search supported chains/tokens, build swap transactions, sign and broadcast EVM transactions, track cross-chain status, and generate pre-filled swap URLs.

## Quickstart

Add to MCP config:

```json
{
  "mcpServers": {
    "rubic": {
      "command": "npx",
      "args": ["-y", "@cryptorubic/mcp"],
      "env": {
        "EVM_WALLET_PRIVATE_KEY": "YOUR_PRIVATE_KEY"
      }
    }
  }
}
```

`EVM_WALLET_PRIVATE_KEY` - EVM private key without `0x`. Enables signing/broadcast tools.

## Local Installation Options

For read-only mode, omit `EVM_WALLET_PRIVATE_KEY`.

### Option A: Node.js

Requires [Node.js v18+](https://nodejs.org/).

```bash
git clone https://github.com/Cryptorubic/rubic-mcp.git
cd rubic-mcp
npm install
npm run build
```

### Option B: Docker

Pull the published image:

```bash
docker pull rubicfinance/rubic-mcp:latest
```

Or build from source:

```bash
git clone https://github.com/Cryptorubic/rubic-mcp.git
cd rubic-mcp
docker build -t rubicfinance/rubic-mcp .
```

## Configuration

In case of local Node.js installation, copy the example config:

```bash
cp .env.example .env
```

Main settings:

- `EVM_WALLET_PRIVATE_KEY` - EVM private key without `0x`. Enables signing/broadcast tools.
- `RUBIC_API_BASE_URL` - Rubic API base URL (default `https://rubic-api-v2.rubic.exchange`).
- `TOKENS_API_BASE_URL` - Rubic tokens API base URL (default `https://api.rubic.exchange/api`).
- `MCP_TRANSPORT` - `stdio` (default) or `http`.
- `MCP_HOST` / `MCP_PORT` - used in HTTP mode.
- `API_TIMEOUT_MS` / `MCP_TOOL_TIMEOUT_MS` - request and tool execution timeouts.

Without `EVM_WALLET_PRIVATE_KEY`, read-only and build tools work, but tools that sign transactions will return an error.

## Connecting to MCP Clients

[Quickstart](#quickstart) section is enough for the most use cases. All of the instructions below are related to local installation options.

All examples below use **stdio** mode.

Replace `/full/path/to` with the actual path printed after `npm run build`.

<details open>
<summary><b>Claude Code</b></summary>

```bash
# With private key
claude mcp add rubic -e EVM_WALLET_PRIVATE_KEY=YOUR_PRIVATE_KEY -- node /full/path/to/dist/index.js

# Read-only / unsigned mode
claude mcp add rubic -- node /full/path/to/dist/index.js
```

Using Docker:

```bash
claude mcp add rubic -e EVM_WALLET_PRIVATE_KEY=YOUR_PRIVATE_KEY -- docker run -i --rm rubicfinance/rubic-mcp:latest node dist/index.js
```

Verify: `claude mcp list`

</details>

<details>
<summary><b>Claude Desktop</b></summary>

Add to `claude_desktop_config.json`:

Node.js:
```json
{
  "mcpServers": {
    "rubic": {
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
    }
  }
}
```

Docker:
```json
{
  "mcpServers": {
    "rubic": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "-e", "EVM_WALLET_PRIVATE_KEY=YOUR_KEY", "rubicfinance/rubic-mcp", "node", "dist/index.js"],
      "env": {}
    }
  }
}
```

</details>

<details>
<summary><b>Cursor</b></summary>

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "rubic": {
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": {
        "EVM_WALLET_PRIVATE_KEY": "YOUR_PRIVATE_KEY"
      }
    }
  }
}
```

</details>

<details>
<summary><b>Windsurf</b></summary>

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "rubic": {
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>GitHub Copilot (VS Code)</b></summary>

Add to `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "rubic": {
      "type": "stdio",
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Cline</b></summary>

Open Cline settings → MCP Servers → Edit MCP Settings:

```json
{
  "mcpServers": {
    "rubic": {
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
    }
  }
}
```

</details>

<details>
<summary><b>Continue</b></summary>

Add to `~/.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "rubic",
      "command": "node",
      "args": ["/full/path/to/dist/index.js"],
      "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
    }
  ]
}
```

</details>

<details>
<summary><b>Zed</b></summary>

Add to `~/.config/zed/settings.json`:

```json
{
  "context_servers": {
    "rubic": {
      "command": {
        "path": "node",
        "args": ["/full/path/to/dist/index.js"],
        "env": { "EVM_WALLET_PRIVATE_KEY": "YOUR_KEY" }
      }
    }
  }
}
```

</details>

### Other clients (generic stdio)

Use command `node` + args `["/full/path/to/dist/index.js"]`, or Docker command:

```bash
docker run -i --rm -e EVM_WALLET_PRIVATE_KEY=YOUR_PRIVATE_KEY rubicfinance/rubic-mcp:latest node dist/index.js
```

## Hosted MCP (Stage)

Use hosted read-only MCP endpoint:

`https://stage-mcp-api-v2.rubic.exchange/mcp`

Example generic MCP config:

```json
{
  "mcpServers": {
    "rubic": {
      "url": "https://stage-mcp-api-v2.rubic.exchange/mcp"
    }
  }
}
```

## Transport modes

### Node.js

```bash
# stdio (default)
npm start

# HTTP mode
MCP_TRANSPORT=http npm run start:http
```

### Docker

```bash
# stdio
docker run -i --rm -e EVM_WALLET_PRIVATE_KEY=YOUR_PRIVATE_KEY rubicfinance/rubic-mcp:latest node dist/index.js

# HTTP mode
docker run -d -p 3333:3333 -e MCP_TRANSPORT=http rubicfinance/rubic-mcp:latest
```

Or with Docker Compose:

```bash
docker compose up -d --build
```

## Development

```bash
npm run dev          # stdio dev mode
npm run dev:http     # HTTP dev mode
npm run lint
npm run typecheck
```

## Security Model

Rubic MCP Server is non-custodial:

- **Private keys never leave your machine.** `EVM_WALLET_PRIVATE_KEY` is read from
  a local `.env` file or MCP client config, used for in-process signing via
  [viem](https://viem.sh), and never transmitted over the network.
- **The server constructs transaction calldata** (`rubic_build_swap_tx`) and returns
  it as a structured JSON object. Signing and broadcast are separate, opt-in steps.
- **Without `EVM_WALLET_PRIVATE_KEY`**, the server operates in read-only mode: quotes,
  token search, chain discovery, and swap URL generation work normally.
  Signing tools return a clear error.
- **The Rubic API** (`rubic-api-v2.rubic.exchange`) receives swap parameters and
  returns routing + calldata. It never receives your private key.

## Tools

Tools are split into **read-only** (work without a key) and **execution**
(require `EVM_WALLET_PRIVATE_KEY`). In hosted mode, only read-only tools
are available.

| Tool | Requires `EVM_WALLET_PRIVATE_KEY` | Description |
|------|:---------------------------------:|-------------|
| `rubic_get_instructions` | - | Returns Rubic MCP usage guide and workflow tips |
| `rubic_get_balances` | - | Returns non-zero native and ERC-20 balances across supported EVM chains |
| `rubic_get_supported_chains` | - | Lists supported blockchain names |
| `rubic_search_tokens` | - | Searches tokens by symbol, name, or address |
| `rubic_quote_routes` | - | Calculates best route or all routes |
| `rubic_simulate_swap` | - | Simulates execution preview (route, fees summary, gas USD, risk level) without signing or broadcasting |
| `rubic_build_swap_tx` | - | Builds executable swap transaction payload |
| `rubic_sign_tx` | Yes | Signs EVM transaction payload |
| `rubic_broadcast_tx` | - | Broadcasts a signed raw transaction |
| `rubic_sign_and_broadcast_tx` | Yes | Signs and broadcasts in one call |
| `rubic_quote_swap_sign_and_broadcast_tx` | Yes | Full flow: quote -> build -> sign -> broadcast |
| `rubic_track_status` | - | Tracks cross-chain status by route id and/or tx hash |
| `rubic_get_swap_url` | - | Generates pre-filled Rubic app swap URL |

## Limitations

Rubic MCP Server does **not**:

- **Custody or store private keys.** Keys exist only in your local env / process memory.
- **Support non-EVM chains for signing.** `rubic_sign_tx` and `rubic_broadcast_tx`
  work only on EVM chains. For non-EVM chains (Solana, TRON, TON, Bitcoin),
  use `rubic_build_swap_tx` to get calldata and sign externally,
  or use `rubic_get_swap_url` for browser-based execution.
- **Execute limit orders or DCA.** Only market swaps via routing aggregation.
- **Guarantee complete portfolio coverage.** `rubic_get_balances` checks tokens from bundled `tokens.json`.
  Custom/unlisted tokens may require manual contract checks.
- **Manage token approvals automatically.** If an ERC-20 approval is needed,
  `rubic_build_swap_tx` returns `approvalAddress` — the user must approve
  separately.
- **Guarantee price.** Quotes are estimates; actual execution price may differ
  due to slippage, MEV, or market movement between quote and broadcast.
- **Support fiat on/off-ramp.** No bank, card, or payment provider integration.

## Response format

All tools return a stable result envelope:

```json
{
  "ok": true,
  "traceId": "uuid",
  "data": {},
  "error": {
    "code": "RUBIC_1001",
    "message": "Human-readable reason",
    "statusCode": 400,
    "details": {}
  }
}
```

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

## License

[MIT](LICENSE)
