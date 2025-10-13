// backend/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import serverless from 'serverless-http';
import costRoutes from './routes/cost.js';
import accountRoutes from './routes/accounts.js'; 
import userRoutes from './routes/users.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();
const app = express();

app.use(cors({
  origin: 'https://cloudbillanalyzer.epiuse-aws.com',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(helmet());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- ADD THIS LOGGING MIDDLEWARE ---
app.use((req, res, next) => {
  console.log(`[REQUEST] ${req.method} ${req.path}`);
  next();
});
// ------------------------------------

app.get('/health', (req, res) => res.json({ status: 'OK' }));

// API routes
app.use('/api/cost', costRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/users', userRoutes);

app.use(errorHandler);
app.use('*', (req, res) => res.status(404).json({ error: 'Route not found' }));

export const handler = serverless(app);