# Use Alpine Linux for smaller image size
FROM node:18-alpine

# Install FFmpeg and dependencies
RUN apk add --no-cache \
    ffmpeg \
    curl

# Verify FFmpeg installation
RUN ffmpeg -version

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy application code
COPY src/ ./src/

# Create temporary directories for processing
RUN mkdir -p /tmp/downloads /tmp/frames

# Set permissions
RUN chmod -R 755 /tmp/downloads /tmp/frames

# Health check (check if process is running)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD pgrep -f "node.*worker.js" > /dev/null || exit 1

# Start worker
CMD ["npm", "start"]