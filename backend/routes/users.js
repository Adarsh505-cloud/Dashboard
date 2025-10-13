// backend/routes/users.js
import express from 'express';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { CognitoIdentityProviderClient, ListUsersCommand, AdminCreateUserCommand, AdminAddUserToGroupCommand, AdminListGroupsForUserCommand, AdminRemoveUserFromGroupCommand, AdminDeleteUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBDocumentClient, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { authenticateUser, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();
const region = process.env.AWS_REGION || "us-west-2";
const userPoolId = process.env.COGNITO_USER_POOL_ID;

const dbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(dbClient);
const cognitoClient = new CognitoIdentityProviderClient({ region });

// GET /api/users - List all users with their groups (Admins only)
router.get('/', authenticateUser, isAdmin, async (req, res, next) => {
  try {
    const listUsersCommand = new ListUsersCommand({ UserPoolId: userPoolId });
    const { Users } = await cognitoClient.send(listUsersCommand);

    if (!Users) return res.json({ success: true, data: [] });

    const usersWithGroups = await Promise.all(Users.map(async (user) => {
      const listGroupsCommand = new AdminListGroupsForUserCommand({
        UserPoolId: userPoolId,
        Username: user.Username,
      });
      const { Groups } = await cognitoClient.send(listGroupsCommand);
      return {
        id: user.Attributes.find(attr => attr.Name === 'sub')?.Value, // Use the sub (UUID) as the primary ID
        username: user.Username, // Keep the original username for Cognito API calls
        email: user.Attributes.find(attr => attr.Name === 'email')?.Value,
        status: user.UserStatus,
        createdAt: user.UserCreateDate ? user.UserCreateDate.toISOString() : null,
        groups: Groups ? Groups.map(g => g.GroupName) : [],
      };
    }));

    res.json({ success: true, data: usersWithGroups });
  } catch (error) { next(error); }
});


// POST /api/users - Create a new user (Admins only)
router.post('/', authenticateUser, isAdmin, async (req, res, next) => {
    const { email, username, temporaryPassword, role } = req.body;
    if (!email || !username || !temporaryPassword || !role || !['Admins', 'Viewers'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Username, email, temporary password, and a valid role are required.' });
    }

    try {
        const createUserCommand = new AdminCreateUserCommand({
            UserPoolId: userPoolId,
            Username: username,
            TemporaryPassword: temporaryPassword,
            UserAttributes: [{ Name: 'email', Value: email }, { Name: 'email_verified', Value: 'true' }],
            // MessageAction: 'SUPPRESS' is removed to allow the invitation email to be sent.
        });
        const { User } = await cognitoClient.send(createUserCommand);
        
        const addUserToGroupCommand = new AdminAddUserToGroupCommand({
            UserPoolId: userPoolId,
            Username: User.Username,
            GroupName: role,
        });
        await cognitoClient.send(addUserToGroupCommand);

        const newUserId = User.Attributes.find(attr => attr.Name === 'sub')?.Value;
        res.status(201).json({ success: true, data: { id: newUserId, email, role }});
    } catch (error) { next(error); }
});

// PUT /api/users/:username/role - Change a user's role
router.put('/:username/role', authenticateUser, isAdmin, async (req, res, next) => {
    const { username } = req.params;
    const { newRole } = req.body;
    if (!newRole || !['Admins', 'Viewers'].includes(newRole)) {
        return res.status(400).json({ error: 'A valid newRole (Admins/Viewers) is required.' });
    }
    try {
        const listGroupsCommand = new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: username });
        const { Groups } = await cognitoClient.send(listGroupsCommand);
        for (const group of Groups) {
            const removeCommand = new AdminRemoveUserFromGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: group.GroupName });
            await cognitoClient.send(removeCommand);
        }
        const addCommand = new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: username, GroupName: newRole });
        await cognitoClient.send(addCommand);
        res.json({ success: true, message: `User role updated to ${newRole}` });
    } catch (error) { next(error); }
});

// GET /api/users/:userId/accounts - Get accounts for a user (userId is the Cognito SUB)
router.get('/:userId/accounts', authenticateUser, isAdmin, async (req, res, next) => {
    const { userId } = req.params;
    try {
        const command = new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
        });
        const { Items } = await docClient.send(command);
        res.json({ success: true, data: Items.map(item => item.accountId) });
    } catch (error) { next(error); }
});

// PUT /api/users/:userId/accounts - Update accounts for a user (userId is the Cognito SUB)
router.put('/:userId/accounts', authenticateUser, isAdmin, async (req, res, next) => {
    const { userId } = req.params;
    const { accountIds } = req.body;
    if (!Array.isArray(accountIds)) {
        return res.status(400).json({ error: "accountIds must be an array." });
    }
    try {
        const queryCommand = new QueryCommand({
            TableName: "UserAccountMappings",
            KeyConditionExpression: "userId = :userId",
            ExpressionAttributeValues: { ":userId": userId },
            ProjectionExpression: "accountId",
        });
        const { Items: existingMappings } = await docClient.send(queryCommand);
        if (existingMappings && existingMappings.length > 0) {
            const deleteRequests = existingMappings.map(item => ({ DeleteRequest: { Key: { userId, accountId: item.accountId } } }));
            await docClient.send(new BatchWriteCommand({ RequestItems: { "UserAccountMappings": deleteRequests } }));
        }
        if (accountIds.length > 0) {
            const putRequests = accountIds.map(accountId => ({ PutRequest: { Item: { userId, accountId } } }));
            await docClient.send(new BatchWriteCommand({ RequestItems: { "UserAccountMappings": putRequests } }));
        }
        res.json({ success: true, message: `Successfully updated accounts for user` });
    } catch (error) { next(error); }
});

// DELETE /api/users/:username - Delete a user (Admins only)
router.delete('/:username', authenticateUser, isAdmin, async (req, res, next) => {
    const { username } = req.params;
    if (!username) {
        return res.status(400).json({ error: 'Username is required' });
    }

    try {
        const command = new AdminDeleteUserCommand({
            UserPoolId: userPoolId,
            Username: username
        });
        await cognitoClient.send(command);
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;