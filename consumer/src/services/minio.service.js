const { minioClient, bucketName } = require('../config/minio.config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Download file from MinIO to local path
 * @param {string} objectName - Object key in MinIO
 * @param {string} localPath - Local file path to save
 */
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
  getObjectMetadata
};