import express from 'express';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers"; 

const router = express.Router();

// Define the Master Payer role ARN you created in Step 1
const CROSS_ACCOUNT_ROLE_ARN = "arn:aws:iam::252078852689:role/CrossAccountBedrockAgentRole";

// Initialize the Bedrock Client by assuming the cross-account role
const client = new BedrockAgentRuntimeClient({ 
    region: "us-east-1", 
    credentials: fromTemporaryCredentials({
        params: {
            RoleArn: CROSS_ACCOUNT_ROLE_ARN,
            RoleSessionName: "BedrockAgentCrossAccountSession",
            DurationSeconds: 3600
        }
    })
});

router.post('/', async (req, res) => {
  try {
    const { accountId, prompt, sessionId, accountType } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Pass live dates so the LLM doesn't hallucinate past years
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    // Automatically detect if we are querying the Master Payer account
    const isMaster = accountType === 'master' || accountId === '252078852689';

    // Build a bulletproof XML-style prompt to force strict obedience from the LLM
    let contextualizedPrompt = `
<system_context>
Today's Date: ${todayStr}
Current Month Start: ${monthStart}
Context Account ID: ${accountId}
</system_context>

<critical_rules>
`;

    if (isMaster) {
        // Master Payer routing logic
        contextualizedPrompt += `1. THIS IS THE MASTER PAYER ORGANIZATION ACCOUNT. 
2. DO NOT filter queries with "WHERE line_item_usage_account_id = '${accountId}'" unless the user explicitly asks for the master account's isolated costs.
3. To get a breakdown by linked account, simply GROUP BY "line_item_usage_account_id". NEVER invent or hallucinate tags for this.
`;
    } else {
        // Linked Account routing logic
        contextualizedPrompt += `1. THIS IS A SINGLE LINKED ACCOUNT.
2. You MUST append "WHERE line_item_usage_account_id = '${accountId}'" to every single CUR query to restrict data to this specific account.
`;
    }

    contextualizedPrompt += `</critical_rules>

USER QUERY: ${prompt}`;

    // FIXED: Appending Date.now() ensures Bedrock doesn't remember the old, broken system prompts 
    // from your previous chats if the frontend isn't passing a unique sessionId.
    const safeSessionId = sessionId || `session-${accountId}-${Date.now()}`;

    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID, 
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID, 
      sessionId: safeSessionId,
      inputText: contextualizedPrompt,
    });

    const response = await client.send(command);

    // Bedrock Agent returns a stream of chunks, we need to decode and concatenate them
    let completion = "";
    for await (const chunkEvent of response.completion) {
      if (chunkEvent.chunk && chunkEvent.chunk.bytes) {
        completion += new TextDecoder("utf-8").decode(chunkEvent.chunk.bytes);
      }
    }

    res.json({ reply: completion });
  } catch (error) {
    console.error('Error invoking Bedrock Agent:', error);
    res.status(500).json({ error: 'Failed to communicate with AI Assistant' });
  }
});

export default router;