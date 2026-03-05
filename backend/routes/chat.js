// backend/routes/chat.js
import express from 'express';
import { BedrockAgentRuntimeClient, InvokeAgentCommand } from "@aws-sdk/client-bedrock-agent-runtime";

const router = express.Router();

// Initialize the Bedrock Agent Client
// It uses the credentials from your environment or IAM role attached to the backend
const client = new BedrockAgentRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

router.post('/', async (req, res) => {
  try {
    const { accountId, prompt, sessionId } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Add context to the prompt so the Bedrock agent knows which account to query via Athena
    const contextualizedPrompt = `The user is asking about AWS Account ID: ${accountId}. Contextualize your data and Athena queries for this specific account. User Query: ${prompt}`;

    const command = new InvokeAgentCommand({
      agentId: process.env.BEDROCK_AGENT_ID, 
      agentAliasId: process.env.BEDROCK_AGENT_ALIAS_ID, 
      sessionId: sessionId || `session-${accountId}`,
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