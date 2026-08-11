# Generic MCP Server for Gmail & Google Docs Integration

A standalone Model Context Protocol (MCP) server that exposes Gmail and Google Docs actions as reusable tools. This allows any MCP-compatible AI agent (Claude, LangGraph, etc.) to securely interact with your Google Workspace.

## Features

- **`gmail_send_email`**: Send an email immediately on behalf of the user.
- **`gmail_create_draft`**: Create an email draft without sending it.
- **`gdocs_append_content`**: Append text to an existing Google Doc.

## Setup Instructions

### 1. Google Cloud Project Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project.
3. Enable the following APIs:
   - Gmail API
   - Google Docs API
4. Go to **APIs & Services > OAuth consent screen** and configure it for "Desktop app" or "Web application".
   - You can leave it in "Testing" mode and add your own email as a Test User.
5. Go to **Credentials > Create Credentials > OAuth client ID**.
6. Download the `credentials.json` or copy the `Client ID` and `Client Secret`.

### 2. Environment Variables

Create a `.env` file in the root directory (you can copy `.env.example`):

```bash
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth2callback
GOOGLE_REFRESH_TOKEN=your_refresh_token
```

### 3. Acquiring a Refresh Token

To use this server, you must provide a `GOOGLE_REFRESH_TOKEN`. You can obtain one by running the OAuth consent flow locally. You can build a small script using `generateAuthUrl` from `src/auth/googleAuth.ts` and visiting the generated URL to get the token, or you can use Google OAuth Playground.

### 4. Build and Run

1. Install dependencies:
   ```bash
   npm install
   ```
2. Build the project:
   ```bash
   npm run build
   ```
3. Run the server (Stdio mode):
   ```bash
   npm start
   ```

## Connecting to an MCP Client

### Cursor / Claude Desktop
Add the following to your MCP client configuration (e.g., in Claude Desktop's `mcp.json` or Cursor's settings):

```json
{
  "mcpServers": {
    "gmail-docs-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/build/index.js"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_REDIRECT_URI": "http://localhost:3000/oauth2callback",
        "GOOGLE_REFRESH_TOKEN": "..."
      }
    }
  }
}
```
