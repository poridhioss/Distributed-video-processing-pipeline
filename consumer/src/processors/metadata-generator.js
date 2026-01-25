const logger = require('../utils/logger');

/**
 * Generate metadata.json for sprite sheet preview
 * @param {string} params.videoId - UUID of the video
 * @param {number} params.videoDuration - Video duration in seconds
 * @param {number} params.frameCount - Total number of thumbnails/frames
 * @param {number} params.thumbnailInterval - Seconds between each thumbnail (default: 2)
 * @param {number} params.thumbnailWidth - Width of each thumbnail (default: 160)
 * @param {number} params.thumbnailHeight - Height of each thumbnail (default: 90)
 * @param {number} params.columns - Number of columns in sprite grid (default: 10)
 * @param {number} params.rows - Number of rows in sprite grid (default: 10)
 * @param {string} params.spriteSheetPath - Path to sprite sheet in MinIO
 * @returns {Object} Metadata JSON object
 */
const generateMetadata = (params) => {
  const {
    videoId,
    videoDuration,
    frameCount,
    thumbnailInterval = 2,
    thumbnailWidth = 160,
    thumbnailHeight = 90,
    columns = 10,
    rows = 10,
    spriteSheetPath
  } = params;

  // Calculate sprite dimensions
  const spriteWidth = thumbnailWidth * columns;
  const spriteHeight = thumbnailHeight * rows;

  // Generate sprite sheet metadata
  const spriteSheet = {
    index: 0,
    url: `/api/videos/${videoId}/sprite/0`,
    thumbnailCount: frameCount,
    startTime: 0,
    endTime: (frameCount - 1) * thumbnailInterval
  };

  // Generate thumbnail position metadata
  const thumbnails = [];
  for (let i = 0; i < frameCount; i++) {
    const column = i % columns;
    const row = Math.floor(i / columns);

    thumbnails.push({
      index: i,
      time: i * thumbnailInterval,
      spriteIndex: 0, // Single sprite only for now
      x: column * thumbnailWidth,
      y: row * thumbnailHeight
    });
  }

  const metadata = {
    videoId,
    videoDuration,
    thumbnailInterval,
    totalThumbnails: frameCount,
    thumbnailWidth,
    thumbnailHeight,
    spriteWidth,
    spriteHeight,
    columns,
    rows: rows,
    spriteSheets: [spriteSheet],
    thumbnails
  };

  logger.info('Metadata generated', {
    videoId,
    frameCount,
    spriteSize: `${spriteWidth}x${spriteHeight}`,
    thumbnailSize: `${thumbnailWidth}x${thumbnailHeight}`
  });

  return metadata;
};

/**
 * Calculate frame positions in sprite sheet
 * Utility function to get x, y coordinates for a specific frame
 * @param {number} frameIndex - Index of the frame (0-based)
 * @param {number} frameWidth - Width of individual frame
 * @param {number} frameHeight - Height of individual frame
 * @param {number} columns - Number of columns in sprite grid
 * @returns {Object} Position {x, y}
 */
const calculateFramePosition = (frameIndex, frameWidth, frameHeight, columns) => {
  const column = frameIndex % columns;
  const row = Math.floor(frameIndex / columns);

  return {
    x: column * frameWidth,
    y: row * frameHeight
  };
};

/**
 * Find thumbnail by time
 * @param {Object} metadata - Metadata object
 * @param {number} time - Time in seconds
 * @returns {Object|null} Thumbnail object or null
 */
const findThumbnailByTime = (metadata, time) => {
  if (!metadata || !metadata.thumbnails) {
    return null;
  }

  // Find closest thumbnail
  let closestThumbnail = metadata.thumbnails[0];
  let minDiff = Math.abs(time - closestThumbnail.time);

  for (const thumbnail of metadata.thumbnails) {
    const diff = Math.abs(time - thumbnail.time);
    if (diff < minDiff) {
      minDiff = diff;
      closestThumbnail = thumbnail;
    }
  }

  return closestThumbnail;
};

module.exports = {
  generateMetadata,
  calculateFramePosition,
  findThumbnailByTime
};
