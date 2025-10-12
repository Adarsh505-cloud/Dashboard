// backend/middleware/authMiddleware.js
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: "us-west-2_XF0vQvYuH", // IMPORTANT: Replace with your User Pool ID
  tokenUse: "access",
  clientId: "641sh8j3j5iv62aot4ecnlpc3q", // IMPORTANT: Replace with your Client ID
});

export const authenticateUser = async (req, res, next) => {
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
    console.error("Authentication error:", error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user && req.user.groups.includes('Admins')) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden: Admins only' });
};