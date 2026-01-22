const { Pool } = require('pg');
const logger = require('../utils/logger');

// PostgreSQL connection pool configuration
const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: process.env.DATABASE_PORT || 5432,
  database: process.env.DATABASE_NAME || 'video_processing',
  user: process.env.DATABASE_USER || 'admin',
  password: process.env.DATABASE_PASSWORD || 'admin123',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
});

// Handle pool errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', {
    error: err.message,
    stack: err.stack
  });
});

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Database connection established', {
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME
    });
    client.release();
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', {
      error: error.message,
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME
    });
    throw error;
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Database pool closed');
  } catch (error) {
    logger.error('Error closing database pool', { error: error.message });
  }
};

module.exports = {
  pool,
  testConnection,
  closePool
};
