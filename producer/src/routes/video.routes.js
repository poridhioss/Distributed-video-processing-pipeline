const express = require('express');
const { getVideoById, getVideosByStatus } = require('../services/database.service');
const { minioClient, bucketName } = require('../config/minio.config');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/videos/:videoId/status
 * Get video processing status
 * Response: { videoId, status, thumbnailCount, error }
 */
router.get('/:videoId/status', async (req, res) => {
  const { videoId } = req.params;

  try {
    const video = await getVideoById(videoId);

    if (!video) {
      return res.status(404).json({
        error: 'Video not found',
        message: `No video found with ID: ${videoId}`
      });
    }

    logger.info('Video status retrieved', { videoId, status: video.status });

    res.status(200).json({
      videoId: video.id,
      status: video.status,
      originalName: video.original_name,
      thumbnailCount: video.thumbnail_count,
      videoDuration: video.video_duration,
      error: video.error_message,
      createdAt: video.created_at,
      updatedAt: video.updated_at
    });
  } catch (error) {
    logger.error('Failed to retrieve video status', {
      videoId,
      error: error.message
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve video status'
    });
  }
});

/**
 * GET /api/videos/:videoId/metadata
 * Get video metadata (sprite sheet info)
 * Response: metadata.json
 */
router.get('/:videoId/metadata', async (req, res) => {
  const { videoId } = req.params;

  try {
    // Check video status first
    const video = await getVideoById(videoId);

    if (!video) {
      return res.status(404).json({
        error: 'Video not found',
        message: `No video found with ID: ${videoId}`
      });
    }

    if (video.status === 'processing') {
      return res.status(503).json({
        error: 'Video processing',
        message: 'Video is still being processed. Please try again later.',
        status: 'processing'
      });
    }

    if (video.status === 'failed') {
      return res.status(500).json({
        error: 'Processing failed',
        message: video.error_message || 'Video processing failed',
        status: 'failed'
      });
    }

    // Get metadata from MinIO
    const metadataKey = `metadata/${videoId}/metadata.json`;

    logger.info('Fetching metadata from MinIO', { videoId, key: metadataKey });

    const dataStream = await minioClient.getObject(bucketName, metadataKey);
    
    let metadataJson = '';
    dataStream.on('data', (chunk) => {
      metadataJson += chunk.toString('utf-8');
    });

    dataStream.on('end', () => {
      logger.info('Metadata retrieved successfully', { videoId });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.status(200).send(metadataJson);
    });

    dataStream.on('error', (error) => {
      logger.error('Failed to stream metadata', {
        videoId,
        error: error.message
      });

      res.status(404).json({
        error: 'Metadata not found',
        message: 'Metadata file not found in storage'
      });
    });

  } catch (error) {
    logger.error('Failed to retrieve metadata', {
      videoId,
      error: error.message
    });

    if (error.code === 'NotFound') {
      return res.status(404).json({
        error: 'Metadata not found',
        message: 'Metadata file not found in storage'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve metadata'
    });
  }
});

/**
 * GET /api/videos/:videoId/stream
 * Stream video file from MinIO with range support
 * Response: video.mp4 (streamed)
 */
router.get('/:videoId/stream', async (req, res) => {
  const { videoId } = req.params;

  try {
    // Check video exists
    const video = await getVideoById(videoId);

    if (!video) {
      return res.status(404).json({
        error: 'Video not found',
        message: `No video found with ID: ${videoId}`
      });
    }

    const videoKey = video.minio_key;

    logger.info('Streaming video from MinIO', { videoId, key: videoKey });

    // Get video metadata from MinIO
    const stat = await minioClient.statObject(bucketName, videoKey);
    const fileSize = stat.size;

    // Handle range requests for video seeking
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      logger.info('Handling range request', {
        videoId,
        start,
        end,
        chunkSize,
        fileSize
      });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': video.mime_type || 'video/mp4'
      });

      // Use getPartialObject for efficient range requests
      const dataStream = await minioClient.getPartialObject(bucketName, videoKey, start, chunkSize);
      
      // Handle stream errors
      dataStream.on('error', (err) => {
        logger.error('Stream error during range request', {
          videoId,
          error: err.message,
          start,
          end
        });
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy();
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        if (!res.writableEnded) {
          logger.info('Client disconnected during range streaming', { videoId });
          dataStream.destroy();
        }
      });

      dataStream.pipe(res);

    } else {
      // Stream entire file
      logger.info('Handling full file request', { videoId, fileSize });

      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': video.mime_type || 'video/mp4',
        'Accept-Ranges': 'bytes'
      });

      const dataStream = await minioClient.getObject(bucketName, videoKey);
      
      // Handle stream errors
      dataStream.on('error', (err) => {
        logger.error('Stream error during full request', {
          videoId,
          error: err.message
        });
        if (!res.headersSent) {
          res.status(500).end();
        } else {
          res.destroy();
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        if (!res.writableEnded) {
          logger.info('Client disconnected during full streaming', { videoId });
          dataStream.destroy();
        }
      });

      dataStream.pipe(res);
    }

  } catch (error) {
    logger.error('Failed to stream video', {
      videoId,
      error: error.message
    });

    if (error.code === 'NotFound') {
      return res.status(404).json({
        error: 'Video not found',
        message: 'Video file not found in storage'
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to stream video'
    });
  }
});

/**
 * GET /api/videos/:videoId/sprite/:index
 * Get sprite sheet by index
 * Response: sprite_0.jpg (image)
 */
router.get('/:videoId/sprite/:index', async (req, res) => {
  const { videoId, index } = req.params;
  const spriteIndex = parseInt(index, 10);

  if (isNaN(spriteIndex) || spriteIndex < 0) {
    return res.status(400).json({
      error: 'Invalid sprite index',
      message: 'Sprite index must be a non-negative integer'
    });
  }

  try {
    // Check video status
    const video = await getVideoById(videoId);

    if (!video) {
      return res.status(404).json({
        error: 'Video not found',
        message: `No video found with ID: ${videoId}`
      });
    }

    if (video.status !== 'completed') {
      return res.status(503).json({
        error: 'Video not ready',
        message: 'Sprite sheet not yet available',
        status: video.status
      });
    }

    // Get sprite from MinIO
    const spriteKey = `sprites/${videoId}/sprite_${spriteIndex}.jpg`;

    logger.info('Fetching sprite from MinIO', { videoId, spriteIndex, key: spriteKey });

    const dataStream = await minioClient.getObject(bucketName, spriteKey);

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.status(200);

    dataStream.pipe(res);

    dataStream.on('error', (error) => {
      logger.error('Failed to stream sprite', {
        videoId,
        spriteIndex,
        error: error.message
      });

      if (!res.headersSent) {
        res.status(404).json({
          error: 'Sprite not found',
          message: `Sprite ${spriteIndex} not found in storage`
        });
      }
    });

  } catch (error) {
    logger.error('Failed to retrieve sprite', {
      videoId,
      spriteIndex,
      error: error.message
    });

    if (error.code === 'NotFound') {
      return res.status(404).json({
        error: 'Sprite not found',
        message: `Sprite ${spriteIndex} not found in storage`
      });
    }

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve sprite'
      });
    }
  }
});

/**
 * GET /api/videos
 * List all videos with optional status filter
 * Response: [{ videoId, originalName, status, createdAt }]
 */
router.get('/', async (req, res) => {
  const { status, limit = 50 } = req.query;

  try {
    let videos;

    if (status) {
      // Filter by status
      const validStatuses = ['uploaded', 'processing', 'completed', 'failed'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Invalid status',
          message: `Status must be one of: ${validStatuses.join(', ')}`
        });
      }

      videos = await getVideosByStatus(status, parseInt(limit, 10));
    } else {
      // Get all videos (implement in database service)
      const { pool } = require('../config/database.config');
      const result = await pool.query(
        'SELECT * FROM videos ORDER BY created_at DESC LIMIT $1',
        [parseInt(limit, 10)]
      );
      videos = result.rows;
    }

    logger.info('Videos retrieved', { count: videos.length, status });

    res.status(200).json({
      count: videos.length,
      videos: videos.map(v => ({
        videoId: v.id,
        originalName: v.original_name,
        fileSize: v.file_size,
        mimeType: v.mime_type,
        status: v.status,
        videoDuration: v.video_duration,
        thumbnailCount: v.thumbnail_count,
        error: v.error_message,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      }))
    });

  } catch (error) {
    logger.error('Failed to retrieve videos', {
      error: error.message
    });

    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve videos'
    });
  }
});

module.exports = router;
