const { spawn } = require('child_process');
const logger = require('./logger');

/**
 * Get video duration using FFprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<number>} Video duration in seconds
 */
const getVideoDuration = (videoPath) => {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ];

    logger.debug('Running FFprobe to get duration', {
      command: 'ffprobe',
      args: ffprobeArgs.join(' ')
    });

    const ffprobe = spawn('ffprobe', ffprobeArgs);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(stdout.trim());

        if (isNaN(duration)) {
          logger.error('FFprobe returned invalid duration', {
            stdout,
            stderr
          });
          reject(new Error('Invalid duration returned by FFprobe'));
          return;
        }

        logger.info('Video duration detected', {
          duration: duration.toFixed(2),
          path: videoPath
        });

        resolve(duration);
      } else {
        logger.error('FFprobe failed', {
          exitCode: code,
          stderr,
          command: `ffprobe ${ffprobeArgs.join(' ')}`
        });
        reject(new Error(`FFprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', (error) => {
      logger.error('FFprobe process error', {
        error: error.message,
        path: videoPath
      });
      reject(error);
    });
  });
};

/**
 * Get comprehensive video metadata using FFprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} Video metadata (duration, width, height, codec, bitrate)
 */
const getVideoMetadata = (videoPath) => {
  return new Promise((resolve, reject) => {
    const ffprobeArgs = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,codec_name,bit_rate:format=duration',
      '-of', 'json',
      videoPath
    ];

    logger.debug('Running FFprobe to get metadata', {
      command: 'ffprobe',
      args: ffprobeArgs.join(' ')
    });

    const ffprobe = spawn('ffprobe', ffprobeArgs);

    let stdout = '';
    let stderr = '';

    ffprobe.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout);
          const stream = data.streams && data.streams[0];
          const format = data.format || {};

          const metadata = {
            duration: parseFloat(format.duration) || 0,
            width: stream?.width || 0,
            height: stream?.height || 0,
            codec: stream?.codec_name || 'unknown',
            bitrate: parseInt(stream?.bit_rate) || 0
          };

          logger.info('Video metadata extracted', {
            duration: metadata.duration.toFixed(2),
            resolution: `${metadata.width}x${metadata.height}`,
            codec: metadata.codec,
            path: videoPath
          });

          resolve(metadata);
        } catch (parseError) {
          logger.error('Failed to parse FFprobe JSON output', {
            error: parseError.message,
            stdout
          });
          reject(new Error('Failed to parse FFprobe output'));
        }
      } else {
        logger.error('FFprobe failed', {
          exitCode: code,
          stderr,
          command: `ffprobe ${ffprobeArgs.join(' ')}`
        });
        reject(new Error(`FFprobe exited with code ${code}`));
      }
    });

    ffprobe.on('error', (error) => {
      logger.error('FFprobe process error', {
        error: error.message,
        path: videoPath
      });
      reject(error);
    });
  });
};

module.exports = {
  getVideoDuration,
  getVideoMetadata
};
