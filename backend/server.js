import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import serverless from 'serverless-http';
import costRoutes from './routes/cost.js';
import accountRoutes from './routes/accounts.js';
import userRoutes from './routes/users.js';
import chatRoutes from './routes/chat.js';
import { errorHandler } from './middleware/errorHandler.js';

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });
const app = express();

// CORS: allow production URL and optionally a local dev URL
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://cloudbillanalyzer.epiuse-aws.com',
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, server-to-server, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple in-memory rate limiter
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 900000); // 15 min
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

app.use((req, res, next) => {
  // Skip rate limiting for health checks
  if (req.path === '/health') return next();

  const key = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(key, { windowStart: now, count: 1 });
    return next();
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'OK' }));

// API routes
app.use('/api/cost', costRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);

app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Lambda handler for production
export const handler = serverless(app);

// Local dev server when run directly (node backend/server.js)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('server.js') || process.argv[1].endsWith('backend/server.js')
);
if (isDirectRun) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    console.log(`SKIP_AUTH=${process.env.SKIP_AUTH || 'false'}`);
  });
}
