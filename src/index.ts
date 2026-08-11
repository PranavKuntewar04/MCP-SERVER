import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { handleGmailSendEmail } from './tools/gmailSendEmail.js';
import { handleGmailCreateDraft } from './tools/gmailCreateDraft.js';
import { handleGdocsAppendContent } from './tools/gdocsAppendContent.js';

const server = new Server({
  name: 'mcp-gmail-docs',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {}
  }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
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
  };
});

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

  // MCP tool call format
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('MCP Gmail & Google Docs Server running on stdio');
}

main().catch(console.error);
