import { sendEmail } from '../services/gmailService.js';
import { GmailSendEmailArgs, ToolResponse } from '../types.js';

export async function handleGmailSendEmail(args: any): Promise<ToolResponse> {
  if (!args.to || !Array.isArray(args.to) || args.to.length === 0) {
    return { success: false, data: null, error: { code: 'INVALID_INPUT', message: 'Missing or invalid "to" field' } };
  }
  if (!args.subject || typeof args.subject !== 'string') {
    return { success: false, data: null, error: { code: 'INVALID_INPUT', message: 'Missing or invalid "subject" field' } };
  }
  if (!args.body || typeof args.body !== 'string') {
    return { success: false, data: null, error: { code: 'INVALID_INPUT', message: 'Missing or invalid "body" field' } };
  }

  try {
    const data = await sendEmail(args as GmailSendEmailArgs);
    return { success: true, data, error: null };
  } catch (err: any) {
    return { success: false, data: null, error: { code: err.message.split(':')[0], message: err.message } };
  }
}
