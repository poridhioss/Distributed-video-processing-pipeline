const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const QUEUE_NAME = process.env.RABBITMQ_QUEUE || 'video_processing';
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

// Queue Options - durable to ensure messages are not lost on RabbitMQ restart
const QUEUE_OPTIONS = {
    durable: true,
};

// Message options - persistent to ensure messages are saved to disk
const MESSAGE_OPTIONS = {
    persistent: true,
};

// Connect to RabbitMQ and create channel
const connect = async () => {
    try {
        logger.info('Connecting to RabbitMQ...', { url: RABBITMQ_URL.replace(/\/\/.*@/, '//***@') });

        // Step 1: Create connection
        connection = await amqp.connect(RABBITMQ_URL);

        // Step 2: Create channel 
        channel = await connection.createChannel();

        // Step 3: Assert queue
        await channel.assertQueue(QUEUE_NAME, QUEUE_OPTIONS);
        logger.info('RabbitMQ connected successfully', { queue: QUEUE_NAME });

        // Handle connection errors
        connection.on('error', (err) => {
            logger.error('RabbitMQ connection error', { error: err.message });
        });

        connection.on('close', () => {
            logger.warn('RabbitMQ connection closed');
        });

        return { connection, channel }
    } catch (error) {
        logger.error('Failed to connect to RabbitMQ', { error: error.message });
        throw error;
    }
}

// Publish message to RabbitMQ queue
const publishToQueue = async (message) => {
    try {
        // Ensure connection and channel are established
        if (!channel) {
            throw new Error('RabbitMQ channel is not established. Call connect() first.');
        }

        // Create message buffer
        const messageBuffer = Buffer.from(JSON.stringify(message));

        // Publish message to queue
        const sent = channel.sendToQueue(QUEUE_NAME, messageBuffer, MESSAGE_OPTIONS);

        if (sent) {
            logger.info('Message published to RabbitMQ queue', { queue: QUEUE_NAME, videoId: message.videoId });
        } else {
            logger.error('Failed to publish message to RabbitMQ queue', { queue: QUEUE_NAME, videoId: message.videoId });
        }

        return sent;
    } catch (error) {
        logger.error('Error publishing message to RabbitMQ', { error: error.message });
        throw error;
    }
}

// Close connection gracefully
const close = async () => {
    try {
        // Close channel and connection
        if (channel) {
            await channel.close();
            logger.info('RabbitMQ channel closed');
        }

        if (connection) {
            await connection.close();
            logger.info('RabbitMQ connection closed');
        }
    } catch (error) {
        logger.error('Error closing RabbitMQ connection', { error: error.message });
        throw error;
    }
}

module.exports = {
    connect,
    publishToQueue,
    close,
    getChannel: () => channel,
    getConnection: () => connection,
};