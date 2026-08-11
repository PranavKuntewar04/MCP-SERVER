import express, { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { handleGmailSendEmail } from './tools/gmailSendEmail.js';
import { handleGmailCreateDraft } from './tools/gmailCreateDraft.js';
import { handleGdocsAppendContent } from './tools/gdocsAppendContent.js';

const app = express();
app.use(express.json());

// --- Health check endpoint (Railway uses this to confirm the service is alive) ---
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', server: 'mcp-gmail-docs', version: '1.0.0' });
});

// --- MCP endpoints ---
const transports = new Map<string, SSEServerTransport>();

// 1. GET /mcp/sse - establishes the SSE connection
app.get('/mcp/sse', async (req: Request, res: Response) => {
  // Optional: Bearer token authentication
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Create standard SSE transport. 
  // It will tell the client to POST messages to /mcp/messages?sessionId=...
  const transport = new SSEServerTransport('/mcp/messages', res);
  
  // Create a fresh MCP server instance for this connection
  const server = new Server(
    { name: 'mcp-gmail-docs', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'gmail_send_email',
        description: 'Send an email immediately via Gmail on behalf of the authenticated user.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
            cc: { type: 'array', items: { type: 'string' } },
            bcc: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string', description: 'Email body content' },
            bodyType: { type: 'string', enum: ['text', 'html'], default: 'text' },
            threadId: { type: 'string', description: 'Optional: reply within an existing thread' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'gmail_create_draft',
        description: 'Create a Gmail draft without sending it.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'array', items: { type: 'string' } },
            cc: { type: 'array', items: { type: 'string' } },
            bcc: { type: 'array', items: { type: 'string' } },
            subject: { type: 'string' },
            body: { type: 'string' },
            bodyType: { type: 'string', enum: ['text', 'html'], default: 'text' }
          },
          required: ['to', 'subject', 'body']
        }
      },
      {
        name: 'gdocs_append_content',
        description: 'Append text content to the end of an existing Google Doc.',
        inputSchema: {
          type: 'object',
          properties: {
            documentId: { type: 'string', description: 'Google Doc ID (or full URL, to be parsed)' },
            content: { type: 'string', description: 'Text content to append' },
            addSeparator: { type: 'boolean', default: false, description: 'Insert a newline/divider before the appended content' }
          },
          required: ['documentId', 'content']
        }
      }
    ]
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    let result;
    switch (name) {
      case 'gmail_send_email':
        result = await handleGmailSendEmail(args || {});
        break;
      case 'gmail_create_draft':
        result = await handleGmailCreateDraft(args || {});
        break;
      case 'gdocs_append_content':
        result = await handleGdocsAppendContent(args || {});
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
    };
  });

  await server.connect(transport);

  // Store the transport so we can route incoming POST messages to it
  transports.set(transport.sessionId, transport);

  res.on('close', () => {
    transports.delete(transport.sessionId);
  });
});

// 2. POST /mcp/messages - handles incoming JSON-RPC messages from clients
app.post('/mcp/messages', async (req: Request, res: Response) => {
  // Optional: Bearer token authentication for messages as well
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }

  await transport.handlePostMessage(req, res);
});

// --- Start the server ---
const PORT = parseInt(process.env.PORT || '3000', 10);
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Gmail & Google Docs Server listening on http://0.0.0.0:${PORT}`);
  console.log(`  → MCP SSE endpoint: GET  /mcp/sse`);
  console.log(`  → MCP msg endpoint: POST /mcp/messages`);
  console.log(`  → Health check:     GET  /health`);
});
