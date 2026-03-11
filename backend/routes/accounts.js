import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, BatchGetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

// Helper: chunk array into batches of given size
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// GET /api/accounts - Fetch accounts based on user role
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    if (req.user.groups.includes('Admins')) {
      const command = new ScanCommand({ TableName: "OnboardedAccounts" });
      const { Items } = await docClient.send(command);
      return res.json({ success: true, data: Items || [] });
    } else {
      const mappingCommand = new (await import("@aws-sdk/lib-dynamodb")).QueryCommand({
        TableName: "UserAccountMappings",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": req.user.id },
      });
      const { Items: mappings } = await docClient.send(mappingCommand);

      if (!mappings || mappings.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // BatchGetCommand supports max 100 keys per request
      const allKeys = mappings.map(m => ({ accountId: m.accountId }));
      const keyChunks = chunkArray(allKeys, 100);
      const allAccounts = [];

      for (const chunk of keyChunks) {
        const batchGetCommand = new BatchGetCommand({
          RequestItems: {
            "OnboardedAccounts": { Keys: chunk },
          },
        });
        const { Responses } = await docClient.send(batchGetCommand);
        if (Responses?.OnboardedAccounts) {
          allAccounts.push(...Responses.OnboardedAccounts);
        }
      }

      return res.json({ success: true, data: allAccounts });
    }
  } catch (error) { next(error); }
});

// POST /api/accounts - Add a new account (Admins only)
router.post('/', authenticateUser, isAdmin, async (req, res, next) => {
  const { accountId, roleArn, name, accountType } = req.body;
  if (!accountId || !roleArn || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const command = new PutCommand({
      TableName: "OnboardedAccounts",
      Item: { accountId, roleArn, name, accountType: accountType || 'standalone' },
    });
    await docClient.send(command);
    res.status(201).json({ success: true, data: { accountId, roleArn, name, accountType: accountType || 'standalone' } });
  } catch (error) { next(error); }
});

// DELETE /api/accounts/:accountId - Delete an account (Admins only)
router.delete('/:accountId', authenticateUser, isAdmin, async (req, res, next) => {
    const { accountId } = req.params;
    if (!accountId) {
        return res.status(400).json({ error: 'Account ID is required' });
    }

    try {
        const command = new DeleteCommand({
            TableName: "OnboardedAccounts",
            Key: { accountId }
        });
        await docClient.send(command);
        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
