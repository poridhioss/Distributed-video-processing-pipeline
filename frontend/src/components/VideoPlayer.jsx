import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { getVideoStreamUrl, getVideoStatus } from '../services/api';
import useVideoMetadata from '../hooks/useVideoMetadata';
import useSpritePreload from '../hooks/useSpritePreload';
import ThumbnailPlugin from './ThumbnailPlugin';
import '../styles/VideoPlayer.css';

const VideoPlayer = () => {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const [videoStatus, setVideoStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [isReady, setIsReady] = useState(false);

  const { metadata, loading: metadataLoading, error: metadataError } = useVideoMetadata(videoId);
  const { spritesLoaded, progress: spriteProgress, error: spriteError } = useSpritePreload(videoId, metadata);

  // Check video status
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const status = await getVideoStatus(videoId);
        console.log('Video status:', status);
        
        if (!isMounted) return;
        
        setVideoStatus(status);

        if (status.status !== 'completed') {
          setStatusError(`Video is ${status.status}. Please wait for processing to complete.`);
        }
      } catch (err) {
        console.error('Failed to fetch video status:', err);
        if (!isMounted) return;
        
        const errorMsg = err.response?.data?.message || err.message || 'Failed to load video status';
        setStatusError(`Error loading video: ${errorMsg}`);
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, [videoId]);

  // Set ready state when all loading is complete
  useEffect(() => {
    if (videoStatus?.status === 'completed' && !metadataLoading && spritesLoaded) {
      console.log('All assets loaded, player ready');
      setIsReady(true);
    }
  }, [videoStatus, metadataLoading, spritesLoaded]);

  // Initialize Video.js player
  useEffect(() => {
    if (!isReady || !videoRef.current || playerRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    console.log('Initializing Video.js player...');

    // Initialize player
    const player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      controlBar: {
        children: [
          'playToggle',
          'progressControl',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'fullscreenToggle',
        ],
      },
    });

    playerRef.current = player;

    // Set video source
    player.src({
      src: getVideoStreamUrl(videoId),
      type: 'video/mp4',
    });

    // Pass metadata to player for thumbnail plugin
    player.videoId = videoId;
    player.thumbnailMetadata = metadata;
    player.spritesLoaded = spritesLoaded;

    // Add thumbnail preview component
    const thumbnailPreview = new ThumbnailPlugin(player);
    player.addChild(thumbnailPreview);

    console.log('Video.js player initialized successfully');

    return () => {
      if (playerRef.current) {
        console.log('Disposing Video.js player');
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [isReady, videoId, metadata, spritesLoaded]);

  const isLoading = !isReady && !statusError && !metadataError && !spriteError;
  const hasError = metadataError || spriteError || statusError;

  if (hasError) {
    return (
      <div className="player-container">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h2>Failed to load video</h2>
          <p>{metadataError || spriteError || statusError}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Video List
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="player-container">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h2>Loading video...</h2>
          <div className="loading-details">
            {!videoStatus && <p>⏳ Checking video status...</p>}
            {videoStatus && videoStatus.status !== 'completed' && (
              <p>⏳ Video is {videoStatus.status}...</p>
            )}
            {videoStatus?.status === 'completed' && metadataLoading && (
              <p>⏳ Loading metadata...</p>
            )}
            {videoStatus?.status === 'completed' && !metadataLoading && metadata && !spritesLoaded && (
              <p>⏳ Preloading sprites... {spriteProgress}%</p>
            )}
            {videoStatus?.status === 'completed' && !metadataLoading && metadata && spritesLoaded && (
              <p>✓ Preparing player...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="player-container">
      <div className="player-header">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Videos
        </button>
        <h2 className="video-title">{videoStatus?.originalName || 'Video Player'}</h2>
      </div>

      <div className="video-player-wrapper">
        <div data-vjs-player>
          <video
            ref={videoRef}
            className="video-js vjs-big-play-centered"
          />
        </div>
      </div>

      <div className="video-info">
        <div className="info-item">
          <span className="info-label">Duration:</span>
          <span className="info-value">
            {metadata && `${Math.floor(metadata.videoDuration / 60)}:${String(Math.floor(metadata.videoDuration % 60)).padStart(2, '0')}`}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Thumbnails:</span>
          <span className="info-value">{metadata?.totalThumbnails || 0}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Sprite Sheets:</span>
          <span className="info-value">{metadata?.spriteSheets?.length || 0}</span>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
