import express from 'express';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

// Bedrock client — in production (Lambda), uses execution role automatically.
// For local dev, set BEDROCK_INVOKE_ROLE_ARN to assume a role with Bedrock permissions.
const BEDROCK_INVOKE_ROLE = process.env.BEDROCK_INVOKE_ROLE_ARN;

const bedrockClient = BEDROCK_INVOKE_ROLE
  ? new BedrockAgentRuntimeClient({
      region: process.env.BEDROCK_REGION || "us-west-2",
      credentials: fromTemporaryCredentials({
        params: { RoleArn: BEDROCK_INVOKE_ROLE, RoleSessionName: "BedrockAgentSession", DurationSeconds: 3600 }
      })
    })
  : new BedrockAgentRuntimeClient({
      region: process.env.BEDROCK_REGION || "us-west-2",
    });

// DynamoDB client — to look up client roleArn from OnboardedAccounts
const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(ddbClient);

// Sanitize user prompt to prevent XML/instruction injection
function sanitizePrompt(raw) {
  if (!raw || typeof raw !== 'string') return '';
  // Strip XML-like tags that could override system context
  return raw.replace(/<\/?[a-zA-Z_][^>]*>/g, '').trim();
}

router.post('/', authenticateUser, async (req, res) => {
  try {
    const { accountId, prompt, sessionId, accountType } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Validate accountId format if provided
    if (accountId && !/^\d{12}$/.test(accountId)) {
      return res.status(400).json({ error: 'Invalid account ID format' });
    }

    const sanitizedPrompt = sanitizePrompt(prompt);
    if (!sanitizedPrompt) {
      return res.status(400).json({ error: 'Prompt is empty after sanitization' });
    }

    // Look up the client's roleArn from DynamoDB (same role used by Express backend Lambda)
    const { Item } = await docClient.send(new GetCommand({
      TableName: "OnboardedAccounts",
      Key: { accountId }
    }));
    if (!Item?.roleArn) {
      return res.status(400).json({ error: 'Account not onboarded or missing roleArn' });
    }
    const clientRoleArn = Item.roleArn;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const isMaster = accountType === 'master' || accountId === '252078852689';

    let contextualizedPrompt = `
<system_context>
Today's Date: ${todayStr}
Current Month Start: ${monthStart}
Context Account ID: ${accountId}
</system_context>

<critical_rules>
`;

    if (isMaster) {
        contextualizedPrompt += `1. THIS IS THE MASTER PAYER ORGANIZATION ACCOUNT.
2. DO NOT filter queries with "WHERE line_item_usage_account_id = '${accountId}'" unless the user explicitly asks for the master account's isolated costs.
3. To get a breakdown by linked account, simply GROUP BY "line_item_usage_account_id". NEVER invent or hallucinate tags for this.
`;
    } else {
        contextualizedPrompt += `1. THIS IS A SINGLE LINKED ACCOUNT (${accountId}).
2. For the CUR "data" table: ALWAYS filter with line_item_usage_account_id = '${accountId}'
3. For the "cur_recomdations_v1" table: ALWAYS filter with account_id = '${accountId}'
4. NEVER use line_item_usage_account_id on cur_recomdations_v1 — that column does not exist there.
`;
    }

    contextualizedPrompt += `</critical_rules>

USER QUERY: ${sanitizedPrompt}`;

    // Use per-user session ID to prevent context leaking between users
    const userId = req.user?.id || 'anonymous';
    const safeSessionId = sessionId || `session-${userId}-${accountId}-${Date.now()}`;

    console.log('[Chat] Invoking Bedrock Agent:', {
      region: process.env.BEDROCK_REGION,
      agentId: process.env.BEDROCK_AGENT_ID,
      aliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      accountId,
      roleArn: clientRoleArn,
      sessionId: safeSessionId
    });

    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId: safeSessionId,
      inputText: contextualizedPrompt,
      sessionState: {
        sessionAttributes: {
          clientRoleArn: clientRoleArn,
          clientAccountId: accountId,
          athenaOutputS3: `s3://cost-analyzer-results-${accountId}-${process.env.ATHENA_REGION || 'us-east-1'}/`,
        }
      }
    });

    const response = await bedrockClient.send(command);

    let completion = "";
    for await (const chunkEvent of response.completion) {
      if (chunkEvent.chunk && chunkEvent.chunk.bytes) {
        completion += new TextDecoder("utf-8").decode(chunkEvent.chunk.bytes);
      }
    }

    res.json({ reply: completion });
  } catch (error) {
    console.error('Error invoking Bedrock Agent:', error.name, error.message);
    console.error('Full error:', JSON.stringify({ name: error.name, code: error.$metadata?.httpStatusCode, region: process.env.BEDROCK_REGION, agentId: process.env.BEDROCK_AGENT_ID, aliasId: process.env.BEDROCK_AGENT_ALIAS_ID }));
    res.status(500).json({ error: 'Failed to communicate with AI Assistant' });
  }
});

export default router;
