const { publishToQueue } = require('../config/rabbitmq.config');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

/**
 * Create and publish video processing task
 * @param {object} videoData - Video metadata
 */
const queueVideoProcessing = async (videoData) => {
    try {
        const taskMessage = {
            videoId: videoData.videoId || uuidv4(),
            bucket: videoData.bucket,
            key: videoData.key,
            timestamp: new Date().toISOString(),
            originalName: videoData.originalName,
            fileSize: videoData.fileSize,
            mimeType: videoData.mimeType
        }

        logger.info('Queuing video processing task...', { videoId: taskMessage.videoId, key: taskMessage.key });
        await publishToQueue(taskMessage);

        return taskMessage;
    } catch (error) {
        logger.error('Failed to queue video processing task.', { error: error.message, videoData });
        throw error;
    }
}

module.exports = {
    queueVideoProcessing
};