import { google, docs_v1 } from 'googleapis';
import { getOAuth2Client } from '../auth/googleAuth.js';
import { GDocsAppendContentArgs } from '../types.js';

function getDocsClient() {
  const auth = getOAuth2Client();
  if (!process.env.GOOGLE_REFRESH_TOKEN) {
    throw new Error('AUTH_ERROR: Google refresh token is missing. Please run the setup script to authorize.');
  }
  return google.docs({ version: 'v1', auth });
}

function parseDocumentId(input: string): string {
  // If it looks like a full URL, try to extract the ID
  const match = input.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return input;
}

export async function appendContent(args: GDocsAppendContentArgs) {
  const docs = getDocsClient();
  const documentId = parseDocumentId(args.documentId);
  
  try {
    // 1. Fetch document to find the end index
    const doc = await docs.documents.get({ documentId });
    if (!doc.data.body || !doc.data.body.content) {
      throw new Error('DOC_ERROR: Document is empty or inaccessible');
    }
    
    // The last element in the content array is always the body end index
    const contentList = doc.data.body.content;
    const lastElement = contentList[contentList.length - 1];
    
    // We need to insert right before the very last newline in the document
    let insertIndex = lastElement.endIndex ? lastElement.endIndex - 1 : 1;
    
    let textToInsert = args.content;
    if (args.addSeparator) {
      textToInsert = '\n---\n' + textToInsert;
    }

    const requests: docs_v1.Schema$Request[] = [
      {
        insertText: {
          location: {
            index: insertIndex
          },
          text: textToInsert
        }
      }
    ];

    const res = await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests
      }
    });

    return {
      documentId,
      replies: res.data.replies,
      documentIdUrl: `https://docs.google.com/document/d/${documentId}/edit`
    };
  } catch (error: any) {
    if (error.code === 404) {
      throw new Error(`DOC_NOT_FOUND: The document was not found or is not accessible. Make sure the ID is correct and the authenticated user has access.`);
    }
    if (error.code === 403) {
      throw new Error(`PERMISSION_DENIED: The authenticated user does not have permission to edit this document.`);
    }
    throw new Error(`DOCS_ERROR: ${error.message}`);
  }
}
