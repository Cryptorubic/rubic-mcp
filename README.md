# Rubic Public MCP

Standalone MCP server that exposes Rubic routing tools and proxies all business logic to Rubic API.

## Tools

- `rubic_quote_routes`
- `rubic_build_swap_tx`
- `rubic_track_status`

All tools return a stable envelope:

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

## Configuration

Copy example env:

```bash
cp .env.example .env
```

Important variables:

- `RUBIC_API_BASE_URL` - API address (default: `https://rubic-api-v2.rubic.exchange`)
- `MCP_TRANSPORT` - `stdio` (default) or `http`
- `MCP_PORT` / `MCP_HOST` - used only in HTTP mode

## Development

```bash
npm install
npm run dev
```

HTTP mode:

```bash
npm run dev:http
```

## Build and run

```bash
npm run build
npm start
```

Build + run in HTTP mode:

```bash
npm run build
npm run start:http
```

## API mapping

The server calls the following Rubic API endpoints:

- `rubic_quote_routes` -> `POST /api/routes/quoteBest` or `POST /api/routes/quoteAll`
- `rubic_build_swap_tx` -> `POST /api/routes/swap`
- `rubic_track_status` -> `GET /api/info/statusExtended`

## Cursor MCP config example

```json
{
  "mcpServers": {
    "rubic": {
      "command": "node",
      "args": ["/full/path/to/rubic-public-mcp/dist/index.js"],
      "env": {
        "RUBIC_API_BASE_URL": "https://rubic-api-v2.rubic.exchange"
      }
    }
  }
}
```
