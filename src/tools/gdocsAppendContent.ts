import { appendContent } from '../services/docsService.js';
import { GDocsAppendContentArgs, ToolResponse } from '../types.js';

export async function handleGdocsAppendContent(args: any): Promise<ToolResponse> {
  if (!args.documentId || typeof args.documentId !== 'string') {
    return { success: false, data: null, error: { code: 'INVALID_INPUT', message: 'Missing or invalid "documentId" field' } };
  }
  if (!args.content || typeof args.content !== 'string') {
    return { success: false, data: null, error: { code: 'INVALID_INPUT', message: 'Missing or invalid "content" field' } };
  }

  try {
    const data = await appendContent(args as GDocsAppendContentArgs);
    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, data: null, error: { code: err.message.split(':')[0], message: err.message } };
  }
}
