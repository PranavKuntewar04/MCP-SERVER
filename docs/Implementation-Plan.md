# Generic MCP Server for Gmail & Google Docs Integration

This implementation plan outlines the steps to build a standalone MCP (Model Context Protocol) server that exposes Gmail and Google Docs actions as reusable tools.

## Tasks

- `[ ]` **Project Setup**
  - `[ ]` Initialize `package.json` and install dependencies
  - `[ ]` Configure `tsconfig.json` for TypeScript
  - `[ ]` Create `.env.example` with required variables
- `[ ]` **Core Implementation**
  - `[ ]` Define shared types and interfaces in `src/types.ts`
  - `[ ]` Implement OAuth2 authentication flow in `src/auth/googleAuth.ts`
  - `[ ]` Build Gmail service wrapper in `src/services/gmailService.ts`
  - `[ ]` Build Google Docs service wrapper in `src/services/docsService.ts`
  - `[ ]` Create tool handler `src/tools/gmailSendEmail.ts`
  - `[ ]` Create tool handler `src/tools/gmailCreateDraft.ts`
  - `[ ]` Create tool handler `src/tools/gdocsAppendContent.ts`
  - `[ ]` Set up MCP server and register tools in `src/index.ts`
- `[ ]` **Testing & Documentation**
  - `[ ]` Write unit tests for tool validation
  - `[ ]` Create comprehensive `README.md`
- `[ ]` **Manual Verification**
  - `[ ]` Run interactive OAuth flow to acquire `refresh_token`
  - `[ ]` Connect server to Cursor/Claude and verify tools end-to-end

## Proposed Changes

### Project Setup and Configuration

Set up the core TypeScript project and initialize the configuration.

#### package.json
Initialize the Node.js project with dependencies (`@modelcontextprotocol/sdk`, `googleapis`, `google-auth-library`, `dotenv`) and dev dependencies (`typescript`, `@types/node`, `jest`, etc.).

#### tsconfig.json
Set up strict TypeScript compilation targeting ES2022, outputting to a `build` or `dist` directory.

#### .env.example
Define the required environment variables:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_REFRESH_TOKEN`

### Core Source Files

Structure the MCP server inside the `src` directory as suggested.

#### src/index.ts
- Initialize the MCP `Server` with `StdioServerTransport`.
- Register tools: `gmail_send_email`, `gmail_create_draft`, and `gdocs_append_content` using MCP schemas.
- Route tool invocations to the appropriate service modules.
- Include robust error handling to return structured errors (e.g., `AUTH_ERROR`, `DOC_NOT_FOUND`) instead of crashing.

#### src/types.ts
- Define common interfaces for tool requests, responses, and structured errors.

### Authentication

Manage the OAuth2 flow and Google Auth client initialization.

#### src/auth/googleAuth.ts
- Setup Google `OAuth2Client`.
- Implement function to initialize credentials from environment variables.
- Include a script or function to perform the initial interactive OAuth consent flow and acquire the `refresh_token`.

### Service Modules

Thin wrappers around the official Google API clients.

#### src/services/gmailService.ts
- Export functions `sendEmail` and `createDraft`.
- Accept clean inputs (to, cc, bcc, subject, body, bodyType, threadId) and interact with `googleapis` Gmail v1 API.

#### src/services/docsService.ts
- Export function `appendContent`.
- Accept document ID, content, and `addSeparator`.
- Interact with `googleapis` Docs v1 API (`documents.batchUpdate`).

### Tool Handlers

Separate modules to validate inputs and call services.

#### src/tools/gmailSendEmail.ts
- Implement the `gmail_send_email` logic, including input validation.

#### src/tools/gmailCreateDraft.ts
- Implement the `gmail_create_draft` logic.

#### src/tools/gdocsAppendContent.ts
- Implement the `gdocs_append_content` logic.

### Documentation

#### README.md
Detailed documentation explaining:
- Google Cloud project setup and enabling APIs.
- Obtaining OAuth credentials.
- Running the auth flow to get the `refresh_token`.
- Connecting the server to MCP clients (like Cursor or Claude Desktop) using Stdio.

## Verification Plan

### Automated Tests
- Unit tests using `Jest` inside `tests/` directory to cover input validation logic in `src/tools/` and verify proper error mapping.

### Manual Verification
1. Run the interactive auth flow to generate a `refresh_token`.
2. Connect the MCP server to Cursor or Claude Desktop locally.
3. Ask the agent to invoke the tools and verify the actual email is sent, the draft appears, and the document is updated.
