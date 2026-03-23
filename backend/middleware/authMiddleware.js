// backend/middleware/authMiddleware.js
import { CognitoJwtVerifier } from "aws-jwt-verify";

const userPoolId = process.env.COGNITO_USER_POOL_ID || "us-west-2_XF0vQvYuH";
const clientId = process.env.COGNITO_CLIENT_ID || "641sh8j3j5iv62aot4ecnlpc3q";

const verifier = CognitoJwtVerifier.create({
  userPoolId,
  tokenUse: "access",
  clientId,
});

export const authenticateUser = async (req, res, next) => {
  // Bypass auth only when explicitly opted in via SKIP_AUTH=true
  if (process.env.SKIP_AUTH === 'true') {
    req.user = {
      id: 'local-dev-id',
      email: 'local-dev@example.com',
      groups: ['Admins']
    };
    return next();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header is missing' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token is missing' });
    }

    const payload = await verifier.verify(token);

    req.user = {
      id: payload.sub,
      email: payload.username,
      groups: payload['cognito:groups'] || [],
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.groups.includes('Admins')) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Admins only' });
};
