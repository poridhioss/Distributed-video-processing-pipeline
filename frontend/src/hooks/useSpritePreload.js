import { useState, useEffect } from 'react';
import { getSpriteUrl } from '../services/api';

/**
 * Custom hook to preload all sprite sheets
 * @param {string} videoId - Video ID
 * @param {Object} metadata - Video metadata containing sprite information
 * @returns {Object} { spritesLoaded, progress, error }
 */
const useSpritePreload = (videoId, metadata) => {
  const [spritesLoaded, setSpritesLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!videoId || !metadata || !metadata.spriteSheets) {
      return;
    }

    const preloadSprites = async () => {
      try {
        setSpritesLoaded(false);
        setError(null);
        setProgress(0);

        const spriteUrls = metadata.spriteSheets.map((_, index) =>
          getSpriteUrl(videoId, index)
        );

        console.log(`Preloading ${spriteUrls.length} sprite sheets...`);

        let loadedCount = 0;

        const loadPromises = spriteUrls.map((url) => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
              loadedCount++;
              setProgress(Math.round((loadedCount / spriteUrls.length) * 100));
              console.log(`Sprite loaded: ${url} (${loadedCount}/${spriteUrls.length})`);
              resolve();
            };

            img.onerror = () => {
              console.error(`Failed to load sprite: ${url}`);
              reject(new Error(`Failed to load sprite: ${url}`));
            };

            img.src = url;
          });
        });

        await Promise.all(loadPromises);
        
        setSpritesLoaded(true);
        setProgress(100);
        console.log('✓ All sprites preloaded successfully');
      } catch (err) {
        console.error('Error preloading sprites:', err);
        setError('Failed to preload sprite sheets');
      }
    };

    preloadSprites();
  }, [videoId, metadata]);

  return { spritesLoaded, progress, error };
};

export default useSpritePreload;
