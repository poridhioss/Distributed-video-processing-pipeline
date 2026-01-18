const Minio = require('minio');
const logger = require('../utils/logger');

const minioConfig = {
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123'
};

// Create MinIO client
const minioClient = new Minio.Client(minioConfig);

// Verify MinIO connection
const verifyConnection = async () => {
  try {
    const bucketName = process.env.MINIO_BUCKET || 'videos';
    const exists = await minioClient.bucketExists(bucketName);
    
    if (exists) {
      logger.info('MinIO connection verified', { bucket: bucketName });
      return true;
    } else {
      logger.error('MinIO bucket does not exist', { bucket: bucketName });
      throw new Error(`Bucket ${bucketName} not found`);
    }
  } catch (error) {
    logger.error('MinIO connection failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  minioClient,
  verifyConnection,
  bucketName: process.env.MINIO_BUCKET || 'videos'
};