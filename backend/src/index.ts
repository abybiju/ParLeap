import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    service: 'ParLeap Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
    },
  });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
});

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');

  ws.on('message', (message) => {
    // Handle WebSocket messages
    console.log('Received message:', message.toString());
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

