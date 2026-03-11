import express from 'express';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

const CROSS_ACCOUNT_ROLE_ARN = process.env.BEDROCK_CROSS_ACCOUNT_ROLE_ARN || "arn:aws:iam::252078852689:role/CrossAccountBedrockAgentRole";

const client = new BedrockAgentRuntimeClient({
    region: process.env.BEDROCK_REGION || "us-east-1",
    credentials: fromTemporaryCredentials({
        params: {
            RoleArn: CROSS_ACCOUNT_ROLE_ARN,
            RoleSessionName: "BedrockAgentCrossAccountSession",
            DurationSeconds: 3600
        }
    })
});

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
        contextualizedPrompt += `1. THIS IS A SINGLE LINKED ACCOUNT.
2. You MUST append "WHERE line_item_usage_account_id = '${accountId}'" to every single CUR query to restrict data to this specific account.
`;
    }

    contextualizedPrompt += `</critical_rules>

USER QUERY: ${sanitizedPrompt}`;

    // Use per-user session ID to prevent context leaking between users
    const userId = req.user?.id || 'anonymous';
    const safeSessionId = sessionId || `session-${userId}-${accountId}-${Date.now()}`;

    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID,
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID,
      sessionId: safeSessionId,
      inputText: contextualizedPrompt,
    });

    const response = await client.send(command);

    let completion = "";
    for await (const chunkEvent of response.completion) {
      if (chunkEvent.chunk && chunkEvent.chunk.bytes) {
        completion += new TextDecoder("utf-8").decode(chunkEvent.chunk.bytes);
      }
    }

    res.json({ reply: completion });
  } catch (error) {
    console.error('Error invoking Bedrock Agent:', error.message);
    res.status(500).json({ error: 'Failed to communicate with AI Assistant' });
  }
});

export default router;
