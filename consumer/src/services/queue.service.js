const { consume, ack, nack } = require('../config/rabbitmq.config');
const logger = require('../utils/logger');

/**
 * Start consuming messages with processor
 * @param {Function} processor - Function to process each task
 */
const startConsuming = async (processor) => {
  try {
    logger.info('Starting queue consumer');
    
    // Define message handler
    const messageHandler = async (content, message) => {
      const startTime = Date.now();
      
      logger.info('Processing task', {
        videoId: content.videoId,
        key: content.key
      });
      
      try {
        // Process the task
        await processor(content);
        
        // Task completed successfully - ACK message
        ack(message);
        
        const duration = Date.now() - startTime;
        logger.info('Task completed successfully', {
          videoId: content.videoId,
          duration: `${duration}ms`
        });
        
      } catch (error) {
        // Task failed - NACK and requeue
        logger.error('Task processing failed', {
          videoId: content.videoId,
          error: error.message,
          stack: error.stack
        });
        
        // Requeue the message for retry
        nack(message, true);
      }
    };
    
    // Start consuming
    await consume(messageHandler);
    
    logger.info('Queue consumer started successfully');
    
  } catch (error) {
    logger.error('Failed to start queue consumer', { error: error.message });
    throw error;
  }
};

module.exports = {
  startConsuming
};