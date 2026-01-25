const express = require('express');
const cors = require('cors');
const { verifyMinioConnection: verifyMinIO } = require('./config/minio.config');
const { connect: connectRabbitMQ, close: closeRabbitMQ } = require('./config/rabbitmq.config');
const { testConnection: testDatabase, closePool: closeDatabase } = require('./config/database.config');
const uploadRoutes = require('./routes/upload.routes');
const videoRoutes = require('./routes/video.routes');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PRODUCER_PORT || 4000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Increase body parser limits for large video uploads (500MB)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Routes
app.use('/upload', uploadRoutes);
app.use('/api/videos', videoRoutes);

// health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'producer',
    timestamp: new Date().toISOString()
  });
});


// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Video Producer Service',
    version: '1.0.0',
    endpoints: {
      upload: 'POST /upload',
      videos: 'GET /api/videos',
      videoStatus: 'GET /api/videos/:videoId/status',
      videoMetadata: 'GET /api/videos/:videoId/metadata',
      videoStream: 'GET /api/videos/:videoId/stream',
      videoSprite: 'GET /api/videos/:videoId/sprite/:index',
      health: 'GET /health'
    }
  });
});


// Start server
const startServer = async () => {
  try {
    logger.info('Starting Producer Service...');
    
    // Test database connection
    await testDatabase();
    logger.info('✓ Database connected');
    
    // Initialize MinIO connection
    await verifyMinIO();
    logger.info('✓ MinIO connected');
    
    // Initialize RabbitMQ connection
    await connectRabbitMQ();
    logger.info('✓ RabbitMQ connected');
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`✓ Producer service running on port ${PORT}`);
      logger.info('Service is ready to accept requests');
    });
    
  } catch (error) {
    logger.error('Failed to start service', { error: error.message });
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  
  try {
    await closeRabbitMQ();
    logger.info('✓ RabbitMQ connection closed');
    
    await closeDatabase();
    logger.info('✓ Database pool closed');
    
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
startServer();