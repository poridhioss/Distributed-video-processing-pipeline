import axios from 'axios';

// Configure axios instance with base URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Upload video file with progress tracking
 * @param {File} file - Video file to upload
 * @param {Function} onProgress - Progress callback (percentage)
 * @returns {Promise<{videoId: string, message: string}>}
 */
export const uploadVideo = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('video', file);

  const response = await api.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      onProgress?.(percentCompleted);
    },
  });

  return response.data;
};

/**
 * Get video processing status
 * @param {string} videoId - Video ID
 * @returns {Promise<{videoId: string, status: string, thumbnailCount: number, error: string}>}
 */
export const getVideoStatus = async (videoId) => {
  const response = await api.get(`/api/videos/${videoId}/status`);
  return response.data;
};

/**
 * Get video metadata (sprite information)
 * @param {string} videoId - Video ID
 * @returns {Promise<Object>} Metadata object with sprite information
 */
export const getVideoMetadata = async (videoId) => {
  const response = await api.get(`/api/videos/${videoId}/metadata`);
  return response.data;
};

/**
 * Get video stream URL
 * @param {string} videoId - Video ID
 * @returns {string} Full URL to video stream
 */
export const getVideoStreamUrl = (videoId) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  return `${baseURL}/api/videos/${videoId}/stream`;
};

/**
 * Get sprite sheet URL
 * @param {string} videoId - Video ID
 * @param {number} index - Sprite index (0, 1, 2...)
 * @returns {string} Full URL to sprite sheet
 */
export const getSpriteUrl = (videoId, index) => {
  const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
  return `${baseURL}/api/videos/${videoId}/sprite/${index}`;
};

/**
 * List all videos
 * @param {string} status - Optional status filter (uploaded, processing, completed, failed)
 * @returns {Promise<Array>} Array of video objects
 */
export const listVideos = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get('/api/videos', { params });
  return response.data;
};

export default api;
