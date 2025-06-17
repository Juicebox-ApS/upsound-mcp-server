# Upsound MCP Server

MCP Server for searching Upsound and get listing details.

## Tools

1. `upsound_search_studios`

   - Search for Upsound studios
   - Required Input: `country` (string)
   - Optional Inputs:
     - `location` (string)
     - `minPrice` (number)
     - `maxPrice` (number)
   - Returns: Array of studios with details like name, price,
     location, etc.

2. `upsound_studio_details`
   - Get detailed information about a specific Upsound studio
   - Required Input: `id` (string)
   - Optional Inputs:
     - `checkin` (string, YYYY-MM-DD)
   - Returns: Detailed listing information including description, etc.

## Features

- Respects Upsound's robots.txt rules
- Uses cheerio for HTML parsing
- No API key required
- Returns structured JSON data
- Reduces context load by flattening and picking data

## Setup

### Installing on Claude Desktop

Before starting make sure [Node.js](https://nodejs.org/) is installed
on your desktop for `npx` to work.

1. Go to: Settings > Developer > Edit Config

2. Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "upsound": {
      "command": "npx",
      "args": ["-y", "juicebox-aps/upsound-mcp-server"]
    }
  }
}
```

To ignore robots.txt for all requests, use this version with
`--ignore-robots-txt` args

```json
{
  "mcpServers": {
    "upsound": {
      "command": "npx",
      "args": [
        "-y",
        "juicebox-aps/upsound-mcp-server",
        "--ignore-robots-txt"
      ]
    }
  }
}
```

3. Restart Claude Desktop and plan your next trip that include
   Upsound!

## Build (for devs)

```bash
npm install
npm run build
```

## License

This MCP server is licensed under the MIT License.
