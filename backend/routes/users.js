// backend/routes/users.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminListGroupsForUserCommand, AdminRemoveUserFromGroupCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const region = process.env.AWS_REGION || "us-west-2";
const userPoolId = process.env.COGNITO_USER_POOL_ID;

const dbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region });

// GET /api/users - List all users with their groups
router.get('/', authenticateUser, isAdmin, async (req, res, next) => {
  try {
    const { Users } = await cognitoClient.send(new ListUsersCommand({ UserPoolId: userPoolId }));
    if (!Users) return res.json({ success: true, data: [] });

    const usersWithGroups = await Promise.all(Users.map(async (user) => {
      const { Groups } = await cognitoClient.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: user.Username }));
      return {
        id: user.Attributes.find(attr => attr.Name === 'sub')?.Value,
        username: user.Username,
        email: user.Attributes.find(attr => attr.Name === 'email')?.Value,
        status: user.UserStatus,
        createdAt: user.UserCreateDate ? user.UserCreateDate.toISOString() : null,
        groups: Groups ? Groups.map(g => g.GroupName) : [],
      };
    }));
    res.json({ success: true, data: usersWithGroups });
  } catch (error) { next(error); }
});

// POST /api/users - Create a new user
router.post('/', authenticateUser, isAdmin, async (req, res, next) => {
    const { email, temporaryPassword, role } = req.body;
    if (!email || !temporaryPassword || !role) return res.status(400).json({ error: 'Email, password, and role are required.' });
    try {
        const { User } = await cognitoClient.send(new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: email,
            TemporaryPassword: temporaryPassword,
            UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
        }));
        await cognitoClient.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: User.Username, GroupName: role }));
        const newUserId = User.Attributes.find(attr => attr.Name === 'sub')?.Value;
        res.status(201).json({ success: true, data: { id: newUserId, email, role }});
    } catch (error) { next(error); }
});

// PUT /api/users/:username/role - Change a user's role
router.put('/:username/role', authenticateUser, isAdmin, async (req, res, next) => {
    const { username } = req.params;
    const { newRole } = req.body;
    if (!newRole || !['Admins', 'Viewers'].includes(newRole)) return res.status(400).json({ error: 'Valid role is required.' });
    try {
        const { Groups } = await cognitoClient.send(new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username }));
        for (const group of Groups) {
            await cognitoClient.send(new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: group.GroupName }));
        }
        await cognitoClient.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: newRole }));
        res.json({ success: true, message: `User role updated` });
    } catch (error) { next(error); }
});

// GET /api/users/:userId/accounts - userId is the Cognito SUB (UUID)
router.get('/:userId/accounts', authenticateUser, isAdmin, async (req, res, next) => {
    const { userId } = req.params;
    try {
        const { Items } = await docClient.send(new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
        }));
        res.json({ success: true, data: Items.map(item => item.accountId) });
    } catch (error) { next(error); }
});

// PUT /api/users/:userId/accounts - userId is the Cognito SUB (UUID)
router.put('/:userId/accounts', authenticateUser, isAdmin, async (req, res, next) => {
    const { userId } = req.params;
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds)) return res.status(400).json({ error: "accountIds must be an array." });
    try {
        const { Items: existing } = await docClient.send(new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
        }));
        if (existing?.length > 0) {
            const deleteRequests = existing.map(item => ({ DeleteRequest: { Key: { userId, accountId: item.accountId } } }));
            await docClient.send(new BatchWriteCommand({ RequestItems: { "UserAccountMappings": deleteRequests } }));
        }
        if (accountIds.length > 0) {
            const putRequests = accountIds.map(accountId => ({ PutRequest: { Item: { userId, accountId } } }));
            await docClient.send(new BatchWriteCommand({ RequestItems: { "UserAccountMappings": putRequests } }));
        }
        res.json({ success: true, message: `Successfully updated accounts` });
    } catch (error) { next(error); }
});

export default router;