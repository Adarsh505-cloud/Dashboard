// backend/routes/accounts.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

// GET /api/accounts - Fetch accounts based on user role
router.get('/', authenticateUser, async (req, res) => {
  try {
    if (req.user.groups.includes('Admins')) {
      // Admins get all accounts
      const command = new ScanCommand({ TableName: "OnboardedAccounts" });
      const { Items } = await docClient.send(command);
      res.json({ success: true, data: Items });
    } else {
      // Viewers get only their assigned accounts
      const mappingCommand = new QueryCommand({
        TableName: "UserAccountMappings",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": req.user.id },
      });
      const { Items: mappings } = await docClient.send(mappingCommand);

      if (!mappings || mappings.length === 0) {
        return res.json({ success: true, data: [] });
      }

      // Fetch the details for the mapped accounts
      const accountScan = new ScanCommand({
        TableName: "OnboardedAccounts",
        FilterExpression: "contains(:accountIds, accountId)",
        ExpressionAttributeValues: {
            ":accountIds": mappings.map(m => m.accountId)
        }
      });
      const { Items } = await docClient.send(accountScan);
      res.json({ success: true, data: Items });
    }
  } catch (error) {
    console.error("Error fetching accounts:", error);
    res.status(500).json({ success: false, error: "Failed to fetch accounts" });
  }
});

// POST /api/accounts - Add a new account (Admins only)
router.post('/', authenticateUser, isAdmin, async (req, res) => {
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
  } catch (error) {
    console.error("Error saving account:", error);
    res.status(500).json({ success: false, error: "Failed to save account" });
  }
});

export default router;