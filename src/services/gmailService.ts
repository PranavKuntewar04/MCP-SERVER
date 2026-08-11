import { google, gmail_v1 } from 'googleapis';
import { getOAuth2Client } from '../auth/googleAuth.js';
import { GmailSendEmailArgs, GmailCreateDraftArgs } from '../types.js';

function getGmailClient() {
  const auth = getOAuth2Client();
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('AUTH_ERROR: Google refresh token is missing. Please run the setup script to authorize.');
  }
  return google.gmail({ version: 'v1', auth });
}

function createEmailMessage(args: GmailSendEmailArgs | GmailCreateDraftArgs): string {
  const to = args.to.join(', ');
  const cc = args.cc ? args.cc.join(', ') : '';
  const bcc = args.bcc ? args.bcc.join(', ') : '';
  
  const headers = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${Buffer.from(args.subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: text/${args.bodyType === 'html' ? 'html' : 'plain'}; charset="UTF-8"`
  ];

  if (cc) headers.push(`Cc: ${cc}`);
  if (bcc) headers.push(`Bcc: ${bcc}`);
  
  // Basic threading support if threadId is provided (only for sending)
  if ('threadId' in args && args.threadId) {
    // Note: true threading requires setting In-Reply-To and References headers correctly, 
    // but we can try just passing it in the API call. 
    // Including it in the API call often suffices for simple cases.
  }

  const messageParts = [
    headers.join('\r\n'),
    '',
    args.body
  ];

  const message = messageParts.join('\r\n');
  
  // Base64url encode
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(args: GmailSendEmailArgs) {
  const gmail = getGmailClient();
  const raw = createEmailMessage(args);

  const requestBody: gmail_v1.Schema$Message = { raw };
  if (args.threadId) {
    requestBody.threadId = args.threadId;
  }

  try {
    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody
    });
    
    return {
      messageId: res.data.id,
      threadId: res.data.threadId
    };
  } catch (error: any) {
    throw new Error(`GMAIL_ERROR: ${error.message}`);
  }
}

export async function createDraft(args: GmailCreateDraftArgs) {
  const gmail = getGmailClient();
  const raw = createEmailMessage(args);

  try {
    const res = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: {
        message: { raw }
      }
    });

    return {
      draftId: res.data.id,
      messageId: res.data.message?.id
    };
  } catch (error: any) {
    throw new Error(`GMAIL_ERROR: ${error.message}`);
  }
}
