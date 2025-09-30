import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import serverless from 'serverless-http'; // Added for Lambda compatibility
import costRoutes from './routes/cost.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

// Security middleware
app.use(helmet());

// Note: Rate limiting is typically handled by API Gateway in a serverless setup.
// The express-rate-limit middleware is removed as it's less effective here.

// CORS configuration for production
app.use(cors({
  origin: 'https://cloudbillanalyzer.epiuse-aws.com', // Hardcoded for production
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production'
  });
});

// API routes
app.use('/api/cost', costRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler for serverless environment
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the handler for AWS Lambda instead of listening on a port
export const handler = serverless(app);