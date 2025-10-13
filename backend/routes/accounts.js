// backend/routes/accounts.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand, QueryCommand, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-west-2" });
const docClient = DynamoDBDocumentClient.from(client);

router.get('/', authenticateUser, async (req, res, next) => {
  try {
    if (req.user.groups.includes('Admins')) {
      const { Items } = await docClient.send(new ScanCommand({ TableName: "OnboardedAccounts" }));
      return res.json({ success: true, data: Items || [] });
    } else {
      const { Items: mappings } = await docClient.send(new QueryCommand({
        TableName: "UserAccountMappings",
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: { ":userId": req.user.id }, // req.user.id is the SUB (UUID)
      }));
      if (!mappings || mappings.length === 0) {
        return res.json({ success: true, data: [] });
      }
      const keys = mappings.map(m => ({ accountId: m.accountId }));
      const { Responses } = await docClient.send(new BatchGetCommand({
        RequestItems: { "OnboardedAccounts": { Keys: keys } },
      }));
      return res.json({ success: true, data: Responses.OnboardedAccounts || [] });
    }
  } catch (error) { next(error); }
});

router.post('/', authenticateUser, isAdmin, async (req, res, next) => {
  const { accountId, roleArn, name } = req.body;
  if (!accountId || !roleArn || !name) return res.status(400).json({ error: 'Missing fields' });
  try {
    await docClient.send(new PutCommand({ TableName: "OnboardedAccounts", Item: { accountId, roleArn, name } }));
    res.status(201).json({ success: true, data: { accountId, roleArn, name } });
  } catch (error) { next(error); }
});

export default router;