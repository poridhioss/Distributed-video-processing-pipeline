const { pool } = require('../config/database.config');
const logger = require('../utils/logger');

/**
 * Update video status to 'processing'
 * @param {string} videoId - UUID of the video
 * @returns {Promise<Object>} Updated video record
 */
const updateVideoToProcessing = async (videoId) => {
  try {
    const query = `
      UPDATE videos
      SET status = 'processing',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [videoId]);

    if (result.rows.length === 0) {
      throw new Error(`Video with id ${videoId} not found`);
    }

    logger.info('Video status updated to processing', { videoId });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update video to processing', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Update video status to 'completed' with metadata
 * @param {string} videoId - UUID of the video
 * @param {Object} data - Completion data
 * @param {number} data.thumbnailCount - Number of thumbnails generated
 * @param {number} data.videoDuration - Video duration in seconds
 * @param {string} data.spriteSheetPath - MinIO path to sprite sheet
 * @param {string} data.metadataPath - MinIO path to metadata.json
 * @returns {Promise<Object>} Updated video record
 */
const updateVideoToCompleted = async (videoId, data) => {
  try {
    const query = `
      UPDATE videos
      SET status = 'completed',
          thumbnail_count = $2,
          video_duration = $3,
          sprite_sheet_path = $4,
          metadata_path = $5,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      videoId,
      data.thumbnailCount,
      data.videoDuration,
      data.spriteSheetPath,
      data.metadataPath
    ];

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error(`Video with id ${videoId} not found`);
    }

    logger.info('Video status updated to completed', {
      videoId,
      thumbnailCount: data.thumbnailCount,
      duration: data.videoDuration
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update video to completed', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Update video status to 'failed' with error message
 * @param {string} videoId - UUID of the video
 * @param {string} errorMessage - Error description
 * @returns {Promise<Object>} Updated video record
 */
const updateVideoToFailed = async (videoId, errorMessage) => {
  try {
    const query = `
      UPDATE videos
      SET status = 'failed',
          error_message = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(query, [videoId, errorMessage]);

    if (result.rows.length === 0) {
      throw new Error(`Video with id ${videoId} not found`);
    }

    logger.warn('Video status updated to failed', {
      videoId,
      error: errorMessage
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update video to failed status', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Get video by ID
 * @param {string} videoId - UUID of the video
 * @returns {Promise<Object|null>} Video record or null
 */
const getVideoById = async (videoId) => {
  try {
    const query = 'SELECT * FROM videos WHERE id = $1';
    const result = await pool.query(query, [videoId]);

    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Failed to get video by id', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  updateVideoToProcessing,
  updateVideoToCompleted,
  updateVideoToFailed,
  getVideoById
};
