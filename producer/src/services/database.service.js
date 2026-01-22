const { pool } = require('../config/database.config');
const logger = require('../utils/logger');

/**
 * Create a new video record with status 'uploaded'
 * @param {Object} videoData - Video information
 * @param {string} videoData.id - UUID of the video
 * @param {string} videoData.originalName - Original filename
 * @param {number} videoData.fileSize - File size in bytes
 * @param {string} videoData.mimeType - MIME type
 * @param {string} videoData.minioKey - MinIO object key
 * @returns {Promise<Object>} Created video record
 */
const createVideoRecord = async (videoData) => {
  try {
    const query = `
      INSERT INTO videos (id, original_name, file_size, mime_type, minio_key, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, 'uploaded', NOW(), NOW())
      RETURNING *
    `;

    const values = [
      videoData.id,
      videoData.originalName,
      videoData.fileSize,
      videoData.mimeType,
      videoData.minioKey
    ];

    const result = await pool.query(query, values);

    logger.info('Video record created', {
      videoId: videoData.id,
      status: 'uploaded'
    });

    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create video record', {
      videoId: videoData.id,
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

/**
 * Get videos by status
 * @param {string} status - Video status
 * @param {number} limit - Maximum number of records
 * @returns {Promise<Array>} Array of video records
 */
const getVideosByStatus = async (status, limit = 10) => {
  try {
    const query = `
      SELECT * FROM videos 
      WHERE status = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await pool.query(query, [status, limit]);

    return result.rows;
  } catch (error) {
    logger.error('Failed to get videos by status', {
      status,
      error: error.message
    });
    throw error;
  }
};

/**
 * Delete video record (for rollback)
 * @param {string} videoId - UUID of the video
 * @returns {Promise<boolean>} Success status
 */
const deleteVideoRecord = async (videoId) => {
  try {
    const query = 'DELETE FROM videos WHERE id = $1';
    await pool.query(query, [videoId]);

    logger.info('Video record deleted', { videoId });
    return true;
  } catch (error) {
    logger.error('Failed to delete video record', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  createVideoRecord,
  getVideoById,
  getVideosByStatus,
  deleteVideoRecord
};
