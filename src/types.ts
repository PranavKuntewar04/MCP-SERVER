export interface GmailSendEmailArgs {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
  threadId?: string;
}

export interface GmailCreateDraftArgs {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  bodyType?: 'text' | 'html';
}

export interface GDocsAppendContentArgs {
  documentId: string;
  content: string;
  addSeparator?: boolean;
}

export interface ToolResponse {
  success: boolean;
  data: any;
  error: {
    code: string;
    message: string;
  } | null;
}
