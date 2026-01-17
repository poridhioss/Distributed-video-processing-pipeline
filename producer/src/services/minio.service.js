const { minioClient, bucketName } = require('../config/minio.config');
const logger = require('../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Upload file to MinIO
 * @param {string} filePath - Local file path
 * @param {string} objectName - Object name in bucket (key)
 * @param {object} metadata - File metadata
 */
const uploadFile = async (filePath, objectName, metadata = {}) => {
    try {
        const fileStats = fs.statSync(filePath);
        const fileStream = fs.createReadStream(filePath);

        logger.info('Uploading file to MinIO...', { bucket: bucketName, object: objectName, size: fileStats.size });

        // Upload filestream to minio
        const result = await minioClient.putObject(bucketName, objectName, fileStream, fileStats.size, metadata);
        logger.info('File uploaded to MinIO successfully.', { bucket: bucketName, object: objectName, etag: result.etag });

        return {
            bucket: bucketName,
            key: objectName,
            size: fileStats.size,
            etag: result.etag,
        };
    } catch (error) {
        logger.error('Failed to upload file to MinIO.', { error: error.message, bucket: bucketName, object: objectName });
        throw error;
    }
}

/**
 * Delete file from MinIO (rollback on error)
 * @param {string} objectName - Object name to delete
 */
const deleteFile = async (objectName) => {
    try {
        await minioClient.removeObject(bucketName, objectName);
        logger.info('File deleted from MinIO successfully.', { bucket: bucketName, object: objectName });
    } catch (error) {
        logger.error('Failed to delete file from MinIO.', { error: error.message, bucket: bucketName, object: objectName });
        throw error;
    }
}

/**
 * Check if file exists in MinIO
 * @param {string} objectName - Object name to check
 */
const fileExists = async (objectName) => {
    try {
        await minioClient.statObject(bucketName, objectName);
        logger.info('File exists in MinIO.', { bucket: bucketName, object: objectName });
        return true;
    } catch (error) {
        if (error.code === 'NotFound') {
            logger.info('File does not exist in MinIO.', { bucket: bucketName, object: objectName });
            return false;
        } else {
            logger.error('Error checking file existence in MinIO.', { error: error.message, bucket: bucketName, object: objectName });
            throw error;
        }
    }
}

/**
 * Get file URL (for later retrieval)
 * @param {string} objectName - Object name
 */
const getFileUrl = (objectName) => {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';

    return `${protocol}://${endpoint}:${port}/${bucketName}/${objectName}`;
}

module.exports = {
  uploadFile,
  deleteFile,
  fileExists,
  getFileUrl
};