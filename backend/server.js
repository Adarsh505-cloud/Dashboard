// backend/server.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import serverless from 'serverless-http';
import costRoutes from './routes/cost.js';
import accountRoutes from './routes/accounts.js'; // <-- Import new route
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors({
  origin: 'https://cloudbillanalyzer.epiuse-aws.com',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// API routes
app.use('/api/cost', costRoutes);
app.use('/api/accounts', accountRoutes); // <-- Add new route

app.use(errorHandler);
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

export const handler = serverless(app);