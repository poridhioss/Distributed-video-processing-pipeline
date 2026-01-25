import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadVideo } from '../services/api';
import '../styles/App.css';

const VideoUpload = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile) => {
    setError(null);

    if (!selectedFile) return;

    // Validate file type
    if (!selectedFile.type.startsWith('video/')) {
      setError('Please select a valid video file');
      return;
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('File size must be less than 500MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const response = await uploadVideo(file, (progressPercent) => {
        setProgress(progressPercent);
      });

      console.log('Upload successful:', response);
      
      // Redirect to HOME page after upload
      navigate(`/`);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.message || 'Failed to upload video. Please try again.');
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    setUploading(false);
  };

  return (
    <div className="upload-container">
      <div className="upload-card">
        <h1>Upload Video</h1>
        <p className="subtitle">Upload a video to generate sprite-based timeline preview</p>

        <div
          className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {!file ? (
            <>
              <div className="drop-zone-icon">📹</div>
              <p className="drop-zone-text">
                Drag and drop your video here, or{' '}
                <label className="file-label">
                  browse
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={{ display: 'none' }}
                  />
                </label>
              </p>
              <p className="drop-zone-hint">Supported formats: MP4, AVI, MOV, MKV (Max 500MB)</p>
            </>
          ) : (
            <div className="file-info">
              <div className="file-icon">✓</div>
              <div className="file-details">
                <p className="file-name">{file.name}</p>
                <p className="file-size">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              {!uploading && (
                <button className="remove-btn" onClick={handleReset}>
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {uploading && (
          <div className="progress-container">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="progress-text">{progress}% Uploaded</p>
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload Video'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            disabled={uploading}
          >
            View All Videos
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoUpload;
