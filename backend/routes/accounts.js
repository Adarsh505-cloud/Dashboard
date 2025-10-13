// backend/routes/accounts.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

// GET /api/accounts - Fetch accounts based on user role
router.get('/', authenticateUser, async (req, res, next) => {
  try {
    // Admins get all accounts from the OnboardedAccounts table
    if (req.user.groups.includes('Admins')) {
      const command = new ScanCommand({ TableName: "OnboardedAccounts" });
      const { Items } = await docClient.send(command);
      return res.json({ success: true, data: Items || [] });
    } 
    
    // Viewers get only their assigned accounts
    else {
      // 1. Get the account IDs assigned to this user from UserAccountMappings
      const mappingCommand = new QueryCommand({
        TableName: "UserAccountMappings",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": req.user.id }, // req.user.id is the UUID (sub) from the token
      });
      const { Items: mappings } = await docClient.send(mappingCommand);

      if (!mappings || mappings.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // 2. Use BatchGetCommand for an efficient lookup of the assigned accounts
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
  const { accountId, roleArn, name } = req.body;
  if (!accountId || !roleArn || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const command = new PutCommand({
      TableName: "OnboardedAccounts",
      Item: { accountId, roleArn, name },
    });
    await docClient.send(command);
    res.status(201).json({ success: true, data: { accountId, roleArn, name } });
  } catch (error) { next(error); }
});

export default router;