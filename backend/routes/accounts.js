// backend/routes/accounts.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand, BatchGetCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

// GET /api/accounts - Fetch accounts based on user role
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    if (req.user.groups.includes('Admins')) {
      const command = new ScanCommand({ TableName: "OnboardedAccounts" });
      const { Items } = await docClient.send(command);
      return res.json({ success: true, data: Items || [] });
    } else {
      const mappingCommand = new QueryCommand({
        TableName: "UserAccountMappings",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": req.user.id },
      });
      const { Items: mappings } = await docClient.send(mappingCommand);

      if (!mappings || mappings.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const keys = mappings.map(m => ({ accountId: m.accountId }));
      const batchGetCommand = new BatchGetCommand({
        RequestItems: {
          "OnboardedAccounts": {
            Keys: keys,
          },
        },
      });

      const { Responses } = await docClient.send(batchGetCommand);
      return res.json({ success: true, data: Responses.OnboardedAccounts || [] });
    }
  } catch (error) { next(error); }
});

// POST /api/accounts - Add a new account (Admins only)
router.post('/', authenticateUser, isAdmin, async (req, res, next) => {
  // FIXED: Added accountType extraction
  const { accountId, roleArn, name, accountType } = req.body;
  if (!accountId || !roleArn || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const command = new PutCommand({
      TableName: "OnboardedAccounts",
      // FIXED: Save accountType to DynamoDB (defaulting to standalone if missing)
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
            Key: {
                accountId: accountId
            }
        });
        await docClient.send(command);
        res.status(200).json({ success: true, message: 'Account deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;