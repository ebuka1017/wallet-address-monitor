// utils/logger.js
/**
 * Structured logging utility
 */
const logger = {
    levels: {
      ERROR: 'error',
      WARN: 'warn',
      INFO: 'info',
      DEBUG: 'debug'
    },
    
    /**
     * Format log entry with timestamp and additional context
     * @param {string} level - Log level
     * @param {string} message - Log message
     * @param {Object} context - Additional context
     * @returns {Object} Formatted log entry
     */
    formatLog(level, message, context = {}) {
      return {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...context
      };
    },
    
    /**
     * Log error messages
     * @param {string} message - Error message
     * @param {Object} context - Additional context
     */
    error(message, context = {}) {
      const formattedLog = this.formatLog(this.levels.ERROR, message, context);
      console.error(JSON.stringify(formattedLog));
      
      // Store errors in database for persistence
      this.storeErrorLog(formattedLog);
    },
    
    /**
     * Log warning messages
     * @param {string} message - Warning message
     * @