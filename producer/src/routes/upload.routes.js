const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const { upload, handleUploadError } = require('../middleware/upload.middleware');
const { uploadFile, deleteFile } = require('../services/minio.service');
const { queueVideoProcessing } = require('../services/queue.service');
const { createVideoRecord, deleteVideoRecord } = require('../services/database.service');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /upload
 * Upload video file
 * 
 * Request: multipart/form-data with 'video' field
 * Response: { success, videoId, message }
 */
router.post('/', upload.single('video'), handleUploadError, async (req, res) => {
    let objectName = null;

    try {
        // Validate file presence
        if (!req.file) {
            return res.status(400).json({ 
                error: 'No file uploaded',
                message: 'Please upload a video file in the "video" field.'
            });
        }

        const videoId = uuidv4();
        const fileExtension = path.extname(req.file.originalname);
        objectName = `uploads/${videoId}${fileExtension}`;

        logger.info('Processing upload request', {
            videoId,
            filename: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype
        });

        // Step 1: Upload file to MinIO
        const uploadResult = await uploadFile(
            req.file.path,
            objectName,
            {
                'Content-Type': req.file.mimetype,
                'Original-Name': req.file.originalname
            }
        )

        // Step 2: Create database record with status 'uploaded'
        await createVideoRecord({
            id: videoId,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            minioKey: uploadResult.key
        });

        // Step 3: Queue video processing task
        const taskMessage = await queueVideoProcessing({
            videoId,
            bucket: uploadResult.bucket,
            key: uploadResult.key,
            originalName: req.file.originalname,
            fileSize: req.file.size,
            mimeType: req.file.mimetype
        })

        // Step 4: Remove local file after upload
        fs.unlink(req.file.path, (err) => {
            if (err) {
                logger.warn('Failed to delete local file after upload', { path: req.file.path, error: err.message });
            } else {
                logger.info('Local file deleted after upload', { path: req.file.path });
            }
        });

        // Step 4: Respond to client
        res.status(200).json({
            success: true,
            videoId: taskMessage.videoId,
            message: 'File uploaded and processing task queued successfully.',
            data: {
                originalName: req.file.originalname,
                size: req.file.size,
                uploadedAt: taskMessage.timestamp
            }
        });

        logger.info('Upload request completed successfully', { videoId: taskMessage.videoId, key: taskMessage.key});
    } catch (error) {
        logger.error('Upload request failed', { error: error.message, stack: error.stack });

        // Rollback: Delete database record if created
        try {
            await deleteVideoRecord(videoId);
            logger.info('Rollback: Database record deleted', { videoId });
        } catch (dbError) {
            logger.error('Rollback failed: could not delete database record', { videoId, error: dbError.message });
        }

        // Rollback: Delete file from MinIO if uploaded
        if (objectName) {
            try {
                await deleteFile(objectName);
                logger.info('Rollback: File deleted from MinIO', { key: objectName });
            } catch (delError) {
                logger.error('Rollback failed: could not delete file from MinIO', { objectName, error: delError.message });
            }
        }

        // Cleanup: Remove local file if exists
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlink(req.file.path, (err) => {
                if (err) {
                    logger.warn('Failed to delete local file during error cleanup', { path: req.file.path, error: err.message });
                } else {
                    logger.info('Local file deleted during error cleanup', { path: req.file.path });
                }
            });
        }

        res.status(500).json({
            error: 'Upload failed',
            message: error.message
        });
    }
})

module.exports = router;