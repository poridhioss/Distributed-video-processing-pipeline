const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug',
}

const log = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString()
    const logEntry = {
        timestamp,
        level,
        message,
        ...meta,
    }

    console.log(JSON.stringify(logEntry))
}

module.exports = {
    error: (message, meta) => log(LOG_LEVELS.ERROR, message, meta),
    warn: (message, meta) => log(LOG_LEVELS.WARN, message, meta),
    info: (message, meta) => log(LOG_LEVELS.INFO, message, meta),
    debug: (message, meta) => log(LOG_LEVELS.DEBUG, message, meta),
}