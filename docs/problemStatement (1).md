# Problem Statement: Generic MCP Server for Gmail & Google Docs Integration

## 1. Overview

AI agents increasingly need to take real-world actions on behalf of users — not just generate text. Two of the most common actions are **communicating via email** and **writing to shared documents**. Today, every agent framework that wants this capability has to hand-roll its own Gmail/Google Docs integration, re-implement OAuth handling, and re-solve the same authentication and error-handling problems.

This project builds a **standalone MCP (Model Context Protocol) server** that exposes Gmail and Google Docs actions as reusable, protocol-compliant tools. Because it speaks MCP rather than being embedded in one agent's codebase, **any MCP-compatible AI agent** (Claude, LangGraph agents, custom agent frameworks, etc.) can connect to it and use the same tools without custom integration work.

## 2. Problem Statement

AI agents currently lack a standardized, reusable way to:
1. Send or draft emails through Gmail on a user's behalf.
2. Append content to an existing Google Doc.

Building this logic directly inside an agent tightly couples the agent to Google's APIs, duplicates auth handling across projects, and makes the capability non-portable. There is a need for a **generic, self-contained MCP server** that any agent can plug into — decoupling "the ability to send email / edit docs" from "the agent that decides to do so."

## 3. Objectives

- Expose Gmail send/draft functionality and Google Docs append functionality as MCP tools with clean, well-documented schemas.
- Keep the server **agent-agnostic** — no hardcoded assumptions about which AI framework is calling it.
- Handle Google OAuth2 authentication and token refresh internally so calling agents never touch raw credentials.
- Return structured, predictable responses (success/failure, resource IDs/links) so any agent can reason about the outcome.
- Make the server easy to run locally (for Cursor/dev) and easy to deploy later (stdio or HTTP/SSE transport).

## 4. Scope

### In Scope
- MCP tool: send an email via Gmail.
- MCP tool: create a Gmail draft (without sending).
- MCP tool: append content to an existing Google Doc (given a document ID).
- OAuth2 authentication flow + token storage/refresh for a single Google account (initially).
- Basic input validation and structured error responses.
- Logging of tool calls for debugging.

### Out of Scope (for v1)
- Reading/searching emails or documents.
- Creating brand-new Google Docs from scratch (only appending to existing ones).
- Multi-user / multi-tenant credential management (v1 assumes one authenticated Google account).
- Rich text/formatting control in Google Docs (v1 appends plain text or simple structured text; advanced formatting is a future enhancement).
- Attachments in emails (future enhancement).

## 5. Functional Requirements

### FR1 — Send Email via Gmail
The agent can invoke a tool to send an email immediately.
- Inputs: recipient(s) (to, cc, bcc — optional), subject, body (plain text and/or HTML), optional reply-to thread ID.
- Behavior: Sends immediately via Gmail API, returns the sent message ID and thread ID.

### FR2 — Draft Email via Gmail
The agent can invoke a tool to create a draft without sending it.
- Inputs: same as FR1 (minus send confirmation).
- Behavior: Creates a Gmail draft, returns the draft ID (and a link to view it, if feasible).

### FR3 — Append Content to Google Doc
The agent can invoke a tool to append content to the end of an existing Google Doc.
- Inputs: document ID (or URL), content to append (plain text; structured paragraphs optional), optional flag to insert a line break/section divider before appending.
- Behavior: Appends content to the end of the doc body via the Google Docs API, returns confirmation + the doc's current end index / revision info.

## 6. MCP Tool Specifications

> These are the tool contracts Cursor should implement. Exact schema syntax will depend on the MCP SDK used (TypeScript or Python), but the shape below should be preserved.

### Tool: `gmail_send_email`
```json
{
  "name": "gmail_send_email",
  "description": "Send an email immediately via Gmail on behalf of the authenticated user.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": { "type": "array", "items": { "type": "string" }, "description": "Recipient email addresses" },
      "cc": { "type": "array", "items": { "type": "string" } },
      "bcc": { "type": "array", "items": { "type": "string" } },
      "subject": { "type": "string" },
      "body": { "type": "string", "description": "Email body content" },
      "bodyType": { "type": "string", "enum": ["text", "html"], "default": "text" },
      "threadId": { "type": "string", "description": "Optional: reply within an existing thread" }
    },
    "required": ["to", "subject", "body"]
  }
}
```

### Tool: `gmail_create_draft`
```json
{
  "name": "gmail_create_draft",
  "description": "Create a Gmail draft without sending it.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "to": { "type": "array", "items": { "type": "string" } },
      "cc": { "type": "array", "items": { "type": "string" } },
      "bcc": { "type": "array", "items": { "type": "string" } },
      "subject": { "type": "string" },
      "body": { "type": "string" },
      "bodyType": { "type": "string", "enum": ["text", "html"], "default": "text" }
    },
    "required": ["to", "subject", "body"]
  }
}
```

### Tool: `gdocs_append_content`
```json
{
  "name": "gdocs_append_content",
  "description": "Append text content to the end of an existing Google Doc.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "documentId": { "type": "string", "description": "Google Doc ID (or full URL, to be parsed)" },
      "content": { "type": "string", "description": "Text content to append" },
      "addSeparator": { "type": "boolean", "default": false, "description": "Insert a newline/divider before the appended content" }
    },
    "required": ["documentId", "content"]
  }
}
```

### Standard Tool Response Shape (all tools)
```json
{
  "success": true,
  "data": { "...": "tool-specific result, e.g. messageId, draftId, documentId" },
  "error": null
}
```
On failure:
```json
{
  "success": false,
  "data": null,
  "error": { "code": "GMAIL_AUTH_ERROR", "message": "Human-readable explanation" }
}
```

## 7. Non-Functional Requirements

- **Generic/reusable**: No agent-specific logic. Tool names, descriptions, and schemas should be self-explanatory to any MCP client.
- **Security**: OAuth2 tokens (client secret, refresh token) must never be exposed to the calling agent or logged in plaintext. Store via `.env` (local dev) with a clear path to a secrets manager later.
- **Reliability**: Handle Google API errors (auth expiry, rate limits, invalid doc ID, invalid email address) gracefully and return structured errors rather than crashing.
- **Observability**: Log each tool invocation (tool name, timestamp, success/failure) for debugging — without logging sensitive content like full email bodies or tokens.
- **Transport flexibility**: Support stdio transport for local/Cursor development; design so HTTP/SSE transport can be added later for remote deployment.
- **Rate-limit awareness**: Respect Gmail/Docs API quotas; surface a clear "rate limited, retry later" error rather than a generic failure.

## 8. Technical Architecture

```
AI Agent (Claude / LangGraph / custom)
        │  (MCP protocol — stdio or HTTP/SSE)
        ▼
 MCP Server (this project)
        │
        ├── Gmail Service Module ──► Gmail API (send, drafts.create)
        ├── Google Docs Service Module ──► Docs API (documents.batchUpdate)
        └── Auth Module ──► Google OAuth2 (token storage + refresh)
```

- **MCP Server layer**: registers the three tools, validates inputs, routes to the right service module, formats responses.
- **Service modules**: thin wrappers around the official Google API client libraries — one module per Google product (Gmail, Docs) so more Google (or non-Google) tools can be added later without touching existing code.
- **Auth module**: handles the OAuth2 flow once (interactive, local), then persists a refresh token; auto-refreshes access tokens on each request.

## 9. Authentication & Authorization

- Use **OAuth2 (installed app / desktop flow)** for v1, since this targets a single user's account initially.
- Required scopes:
  - `https://www.googleapis.com/auth/gmail.send` — send email
  - `https://www.googleapis.com/auth/gmail.compose` — create drafts
  - `https://www.googleapis.com/auth/documents` — append to Docs
- Credentials needed: `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI` from a Google Cloud project with Gmail API and Docs API enabled.
- On first run, perform the interactive consent flow once; store the resulting refresh token securely (e.g., local encrypted file or `.env`, gitignored).
- All subsequent runs silently refresh the access token using the stored refresh token — no repeated user interaction.
- Document clearly in the README how another developer/agent operator would set up their own Google Cloud credentials (since this must be generic, not tied to one hardcoded account).

## 10. Recommended Tech Stack

| Component | Recommendation |
|---|---|
| Language | TypeScript (Node.js) — most mature official MCP SDK (`@modelcontextprotocol/sdk`); Python (`mcp` package) is a valid alternative if preferred |
| Google API clients | `googleapis` (Node) or `google-api-python-client` (Python) |
| Auth | `google-auth-library` (Node) or `google-auth` (Python) |
| Config | `.env` via `dotenv` |
| Transport | `StdioServerTransport` for local/Cursor use |

## 11. Suggested Project Structure

```
mcp-gmail-docs-server/
├── src/
│   ├── index.ts                 # MCP server entrypoint, tool registration
│   ├── auth/
│   │   └── googleAuth.ts         # OAuth2 flow, token storage/refresh
│   ├── tools/
│   │   ├── gmailSendEmail.ts
│   │   ├── gmailCreateDraft.ts
│   │   └── gdocsAppendContent.ts
│   ├── services/
│   │   ├── gmailService.ts       # Gmail API wrapper
│   │   └── docsService.ts        # Docs API wrapper
│   └── types.ts                  # shared response/error types
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## 12. Error Handling & Edge Cases

- Invalid/missing OAuth token → return `AUTH_ERROR`, instruct re-running the auth setup script.
- Malformed email addresses → validate before calling Gmail API, return `INVALID_INPUT`.
- Invalid or inaccessible `documentId` (not shared with the authenticated account, or doesn't exist) → return `DOC_NOT_FOUND` or `PERMISSION_DENIED`.
- Google API rate limit (429) → return `RATE_LIMITED` with a retry hint.
- Network/timeout errors → return `UPSTREAM_ERROR` with the underlying message for debugging.

## 13. Testing Strategy

- Unit tests for input validation logic (mocked Google API responses).
- Integration test against a real test Gmail account + a real scratch Google Doc (manual or CI-gated, since it hits live APIs).
- Manual test via Cursor/Claude Desktop MCP config: connect the server, invoke each of the three tools, verify results in Gmail/Docs directly.

## 14. Deliverables

1. Working MCP server exposing `gmail_send_email`, `gmail_create_draft`, `gdocs_append_content`.
2. `README.md` with setup instructions: Google Cloud project setup, enabling APIs, obtaining OAuth credentials, running the auth flow, and connecting the server to an MCP client (Cursor, Claude Desktop, etc.).
3. `.env.example` documenting required environment variables.
4. Basic test suite covering input validation and error paths.

## 15. Success Criteria

- An MCP client (e.g., Claude Desktop or Cursor's agent) can list the three tools and successfully invoke each one end-to-end.
- A sent email actually arrives in the recipient's inbox; a draft actually appears in Gmail Drafts; appended content actually shows up at the end of the target Google Doc.
- Errors (bad doc ID, invalid email, expired auth) return clear, structured messages instead of crashing the server.
- The server has no hardcoded agent-specific logic — it works the same regardless of which MCP client connects to it.

## 16. Assumptions & Constraints

- Single Google account per server instance for v1 (no multi-tenant credential switching).
- Requires a Google Cloud project with Gmail API and Docs API enabled, plus OAuth consent screen configured (can stay in "Testing" mode for personal/dev use).
- Google API quotas apply (Gmail send quota, Docs API request quota) — not expected to be a bottleneck at agent-usage scale, but worth noting.

## 17. Future Enhancements

- Support creating new Google Docs (not just appending to existing ones).
- Support rich formatting (headings, bold, bullet lists) in Docs appends.
- Support email attachments.
- Multi-user credential management (per-agent or per-user token scoping).
- Additional tools: reading/searching emails, reading doc content, Google Sheets/Slides support.
- Remote deployment via HTTP/SSE transport with proper API-key/auth gating for the MCP server itself.
