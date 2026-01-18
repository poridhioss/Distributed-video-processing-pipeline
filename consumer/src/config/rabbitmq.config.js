const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'video_processing';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

// Prefetch count: Worker receives 1 message at a time (fair dispatch)
const PREFETCH_COUNT = 1;

/**
 * Connect to RabbitMQ and set up consumer channel
 */
const connect = async () => {
  try {
    logger.info('Connecting to RabbitMQ...', {
      url: RABBITMQ_URL.replace(/\/\/.*@/, '//***@')
    });
    
    // Create connection
    connection = await amqp.connect(RABBITMQ_URL);
    
    // Create channel
    channel = await connection.createChannel();
    
    // Set prefetch to 1
    await channel.prefetch(PREFETCH_COUNT);
    
    // Assert queue exists
    await channel.assertQueue(QUEUE_NAME, {
      durable: true  // Queue survives broker restart
    });
    
    logger.info('RabbitMQ connected successfully', {
      queue: QUEUE_NAME,
      prefetch: PREFETCH_COUNT
    });
    
    // Handle connection errors
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error', { error: err.message });
    });
    
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      // Implement reconnection logic in production
    });
    
    return { connection, channel };
  } catch (error) {
    logger.error('Failed to connect to RabbitMQ', { error: error.message });
    throw error;
  }
};

/**
 * Start consuming messages from queue
 * @param {Function} messageHandler - Callback to process each message
 */
const consume = async (messageHandler) => {
  try {
    if (!channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    
    logger.info('Starting to consume messages', { queue: QUEUE_NAME });
    
    // Start consuming with noAck=false (manual acknowledgment)
    await channel.consume(
      QUEUE_NAME,
      async (message) => {
        if (message !== null) {
          try {
            // Parse message content
            const content = JSON.parse(message.content.toString());
            
            logger.info('Message received', {
              videoId: content.videoId,
              key: content.key
            });
            
            // Process message
            await messageHandler(content, message);
            
          } catch (error) {
            logger.error('Error processing message', {
              error: error.message,
              stack: error.stack
            });
            
            // Reject message and requeue
            channel.nack(message, false, true);
          }
        }
      },
      {
        noAck: false  // Manual acknowledgment required
      }
    );
    
    logger.info('Consumer started successfully');
    
  } catch (error) {
    logger.error('Failed to start consumer', { error: error.message });
    throw error;
  }
};

/**
 * Acknowledge message (task completed successfully)
 */
const ack = (message) => {
  try {
    channel.ack(message);
    logger.info('Message acknowledged', {
      messageId: message.properties.messageId
    });
  } catch (error) {
    logger.error('Failed to acknowledge message', { error: error.message });
  }
};

/**
 * Reject message and requeue (task failed, retry)
 */
const nack = (message, requeue = true) => {
  try {
    channel.nack(message, false, requeue);
    logger.warn('Message rejected', {
      messageId: message.properties.messageId,
      requeue
    });
  } catch (error) {
    logger.error('Failed to reject message', { error: error.message });
  }
};

/**
 * Close connection gracefully
 */
const close = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection', { error: error.message });
  }
};

module.exports = {
  connect,
  consume,
  ack,
  nack,
  close,
  getChannel: () => channel,
  getConnection: () => connection
};