import { useState, useEffect } from 'react';
import { getVideoMetadata } from '../services/api';

/**
 * Custom hook to fetch and manage video metadata
 * @param {string} videoId - Video ID
 * @returns {Object} { metadata, loading, error }
 */
const useVideoMetadata = (videoId) => {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId) {
      setLoading(false);
      return;
    }

    const fetchMetadata = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await getVideoMetadata(videoId);
        setMetadata(data);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
        setError(err.response?.data?.message || 'Failed to load video metadata');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();
  }, [videoId]);

  return { metadata, loading, error };
};

export default useVideoMetadata;
