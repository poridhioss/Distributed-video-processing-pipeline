const { minioClient, bucketName } = require('../config/minio.config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

// Download file from MinIO to local path
const downloadFile = async (objectName, localPath) => {
  try {
    logger.info('Downloading file from MinIO', {
      bucket: bucketName,
      object: objectName,
      destination: localPath
    });
    
    // Ensure directory exists
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Download file as stream
    await minioClient.fGetObject(bucketName, objectName, localPath);
    
    // Verify download
    const stats = fs.statSync(localPath);
    
    logger.info('File downloaded successfully', {
      bucket: bucketName,
      object: objectName,
      size: stats.size,
      path: localPath
    });
    
    return {
      path: localPath,
      size: stats.size
    };
    
  } catch (error) {
    logger.error('MinIO download failed', {
      bucket: bucketName,
      object: objectName,
      error: error.message
    });
    throw error;
  }
};


/**
 * Upload a single file to MinIO
 * @param {string} localPath - Local file path
 * @param {string} objectName - Destination object name in MinIO
 */
const uploadFile = async (localPath, objectName) => {
  try {
    const stats = fs.statSync(localPath)
    const fileStream = fs.createReadStream(localPath);
    
    logger.debug('Uploading file to MinIO', {
      bucket: bucketName,
      object: objectName,
      size: stats.size
    });

    await minioClient.putObject(
      bucketName, 
      objectName, 
      fileStream, 
      stats.size,
      { 'Content-Type': 'image/jpeg' }
    );

    logger.debug('File uploaded successfully', {
      bucket: bucketName,
      object: objectName
    });

    return {
      bucket: bucketName,
      key: objectName,
      size: stats.size
    }
  } catch (error) {
    logger.error('MinIO upload failed', {
      bucket: bucketName,
      object: objectName,
      error: error.message
    });
    throw error;
  }
};

/**
 * Upload multiple thumbnails to MinIO
 * @param {string} videoId - Video ID for directory structure
 * @param {string[]} thumbnailPaths - Array of local thumbnail paths
 */
const uploadThumbnails = async (videoId, thumbnailPaths) => {
  try {
    logger.info('Uploading thumbnails to MinIO', {
      videoId,
      count: thumbnailPaths.length
    });
    
    const uploadPromises = thumbnailPaths.map((thumbnailPath) => {
      const filename = path.basename(thumbnailPath);
      const objectName = `thumbnails/${videoId}/${filename}`;
      return uploadFile(thumbnailPath, objectName);
    });
    
    const results = await Promise.all(uploadPromises);
    
    logger.info('All thumbnails uploaded successfully', {
      videoId,
      count: results.length,
      totalSize: results.reduce((sum, r) => sum + r.size, 0)
    });
    
    return results;
    
  } catch (error) {
    logger.error('Failed to upload thumbnails', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Upload sprite sheet to MinIO
 * @param {string} videoId - Video ID
 * @param {string} spritePath - Local path to sprite sheet
 * @param {number} spriteIndex - Index of sprite (default: 0)
 * @returns {Promise<Object>} Upload result
 */
const uploadSpriteSheet = async (videoId, spritePath, spriteIndex = 0) => {
  try {
    const objectName = `sprites/${videoId}/sprite_${spriteIndex}.jpg`;
    const result = await uploadFile(spritePath, objectName);

    logger.info('Sprite sheet uploaded', {
      videoId,
      spriteIndex,
      objectName,
      size: result.size
    });

    return result;
  } catch (error) {
    logger.error('Failed to upload sprite sheet', {
      videoId,
      spriteIndex,
      error: error.message
    });
    throw error;
  }
};

/**
 * Upload metadata.json to MinIO
 * @param {string} videoId - Video ID
 * @param {Object} metadata - Metadata object
 * @returns {Promise<Object>} Upload result
 */
const uploadMetadata = async (videoId, metadata) => {
  try {
    const objectName = `metadata/${videoId}/metadata.json`;
    const metadataJson = JSON.stringify(metadata, null, 2);
    const buffer = Buffer.from(metadataJson, 'utf-8');

    logger.debug('Uploading metadata to MinIO', {
      videoId,
      objectName,
      size: buffer.length
    });

    await minioClient.putObject(
      bucketName,
      objectName,
      buffer,
      buffer.length,
      { 'Content-Type': 'application/json' }
    );

    logger.info('Metadata uploaded successfully', {
      videoId,
      objectName,
      size: buffer.length
    });

    return {
      bucket: bucketName,
      key: objectName,
      size: buffer.length
    };
  } catch (error) {
    logger.error('Failed to upload metadata', {
      videoId,
      error: error.message
    });
    throw error;
  }
};

/**
 * Check if object exists in MinIO
 */
const objectExists = async (objectName) => {
  try {
    await minioClient.statObject(bucketName, objectName);
    return true;
  } catch (error) {
    if (error.code === 'NotFound') {
      return false;
    }
    throw error;
  }
};

/**
 * Get object metadata
 */
const getObjectMetadata = async (objectName) => {
  try {
    const stat = await minioClient.statObject(bucketName, objectName);
    return {
      size: stat.size,
      etag: stat.etag,
      lastModified: stat.lastModified,
      metaData: stat.metaData
    };
  } catch (error) {
    logger.error('Failed to get object metadata', {
      bucket: bucketName,
      object: objectName,
      error: error.message
    });
    throw error;
  }
};

module.exports = {
  downloadFile,
  objectExists,
  getObjectMetadata,
  uploadFile,
  uploadThumbnails,
  uploadSpriteSheet,
  uploadMetadata
};