// backend/routes/users.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProviderClient, ListUsersCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const region = process.env.AWS_REGION || "us-west-2";

// Initialize clients
const dbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region });

// GET /api/users - List all users (Admins only)
router.get('/', authenticateUser, isAdmin, async (req, res) => {
  try {
    const command = new ListUsersCommand({
      UserPoolId: process.env.COGNITO_USER_POOL_ID, // You'll need to set this environment variable
    });
    const { Users } = await cognitoClient.send(command);
    
    // Map to a more friendly format
    const formattedUsers = Users.map(user => ({
        id: user.Username,
        email: user.Attributes.find(attr => attr.Name === 'email')?.Value,
        status: user.UserStatus,
        createdAt: user.UserCreateDate,
    }));

    res.json({ success: true, data: formattedUsers });
  } catch (error) {
    console.error("Error listing users:", error);
    res.status(500).json({ success: false, error: "Failed to list users" });
  }
});

// GET /api/users/:userId/accounts - Get accounts assigned to a specific user
router.get('/:userId/accounts', authenticateUser, isAdmin, async (req, res) => {
    const { userId } = req.params;
    try {
        const command = new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
        });
        const { Items } = await docClient.send(command);
        res.json({ success: true, data: Items.map(item => item.accountId) });
    } catch (error) {
        console.error(`Error fetching accounts for user ${userId}:`, error);
        res.status(500).json({ success: false, error: "Failed to fetch user accounts" });
    }
});

// PUT /api/users/:userId/accounts - Update account assignments for a user
router.put('/:userId/accounts', authenticateUser, isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { accountIds } = req.body; // Expecting an array of account IDs

    if (!Array.isArray(accountIds)) {
        return res.status(400).json({ error: "accountIds must be an array." });
    }

    try {
        // First, delete all existing mappings for this user
        const queryCommand = new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ProjectionExpression: "accountId",
        });
        const { Items: existingMappings } = await docClient.send(queryCommand);
        
        if (existingMappings && existingMappings.length > 0) {
            const deleteRequests = existingMappings.map(item => ({
                DeleteRequest: { Key: { userId, accountId: item.accountId } }
            }));
            const batchDeleteCommand = new BatchWriteCommand({
                RequestItems: { "UserAccountMappings": deleteRequests }
            });
            await docClient.send(batchDeleteCommand);
        }

        // Now, add the new mappings
        if (accountIds.length > 0) {
            const putRequests = accountIds.map(accountId => ({
                PutRequest: { Item: { userId, accountId } }
            }));
            const batchPutCommand = new BatchWriteCommand({
                RequestItems: { "UserAccountMappings": putRequests }
            });
            await docClient.send(batchPutCommand);
        }

        res.json({ success: true, message: `Successfully updated accounts for user ${userId}` });

    } catch (error) {
        console.error(`Error updating accounts for user ${userId}:`, error);
        res.status(500).json({ success: false, error: "Failed to update user accounts" });
    }
});

export default router;