const Minio = require('minio');
const logger = require('../utils/logger');

// MinIO Client Configuration
const minioConfig = {
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    useSSL: process.env.MINIO_USE_SSL === 'true' || false,
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
}

// Create MinIO Client
const minioClient = new Minio.Client(minioConfig);

// Verify MinIO Connection
const verifyMinioConnection = async () => {
    try {
        const bucketName = process.env.MINIO_BUCKET || 'videos';
        const exists = await minioClient.bucketExists(bucketName);

        if (exists) {
            logger.info(`MinIO connection verified.`, { bucket: bucketName });
        } else {
            logger.error('MinIO bucket does not exist.', { bucket: bucketName });
            throw new Error(`Bucket "${bucketName}" does not exist.`);
        }

        return true;
    } catch (error) {
        logger.error('Failed to connect to MinIO.', { error: error.message });
        throw error;
    }
}

module.exports = {
    minioClient,
    verifyMinioConnection,
    bucketName: process.env.MINIO_BUCKET || 'videos',
};