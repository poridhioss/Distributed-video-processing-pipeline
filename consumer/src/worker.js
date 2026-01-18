const { verifyConnection: verifyMinIO } = require('./config/minio.config');
const { connect: connectRabbitMQ, close: closeRabbitMQ } = require('./config/rabbitmq.config');
const { startConsuming } = require('./services/queue.service');
const { processVideo } = require('./processors/thumbnail.processor');
const logger = require('./utils/logger');

const WORKER_ID = process.env.HOSTNAME || 'worker-1';

const startWorker = async () => {
  try {
    logger.info('Starting Video Processing Worker', { workerId: WORKER_ID });
    
    // Step 1: Verify MinIO connection
    await verifyMinIO();
    logger.info('✓ MinIO connected');
    
    // Step 2: Connect to RabbitMQ
    await connectRabbitMQ();
    logger.info('✓ RabbitMQ connected');
    
    // Step 3: Start consuming messages
    logger.info('Worker ready to process tasks');
    await startConsuming(processVideo);
    
    logger.info('Worker started successfully', {
      workerId: WORKER_ID,
      status: 'LISTENING'
    });
    
  } catch (error) {
    logger.error('Failed to start worker', {
      workerId: WORKER_ID,
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};


const shutdown = async (signal) => {
  logger.info('Shutdown signal received', { signal, workerId: WORKER_ID });
  
  try {
    // Close RabbitMQ connection
    await closeRabbitMQ();
    logger.info('✓ RabbitMQ connection closed');
    
    logger.info('Worker shutdown complete', { workerId: WORKER_ID });
    process.exit(0);
    
  } catch (error) {
    logger.error('Error during shutdown', {
      workerId: WORKER_ID,
      error: error.message
    });
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', {
    workerId: WORKER_ID,
    error: error.message,
    stack: error.stack
  });
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', {
    workerId: WORKER_ID,
    reason,
    promise
  });
  shutdown('UNHANDLED_REJECTION');
});

// Start the worker
startWorker();