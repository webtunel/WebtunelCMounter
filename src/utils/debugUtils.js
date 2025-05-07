const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Log file path
const LOG_FILE = path.join(os.homedir(), '.webtunel-c-mounter', 'debug.log');

// List of fields that should be masked when logging
const SENSITIVE_FIELDS = ['password', 'privateKey', 'secret', 'key', 'token'];

// Initialize log file
const initLogFile = async () => {
  try {
    await fs.ensureDir(path.dirname(LOG_FILE));
    if (!await fs.pathExists(LOG_FILE)) {
      await fs.writeFile(LOG_FILE, '--- WebtunelCMounter Debug Log ---\n');
    }
  } catch (error) {
    console.error(`Failed to initialize log file: ${error.message}`);
  }
};

// Initialize on module load
initLogFile();

/**
 * Mask sensitive information in objects before logging
 * 
 * @param {any} data - Data to mask sensitive fields in
 * @returns {any} - Data with masked sensitive fields
 */
const maskSensitiveData = (data) => {
  if (!data) return data;
  
  // Return primitive types as is
  if (typeof data !== 'object') return data;
  
  // Handle arrays
  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }
  
  // Handle objects
  const maskedData = { ...data };
  
  // Recursive masking
  for (const key in maskedData) {
    // If this is a sensitive field, mask it
    if (SENSITIVE_FIELDS.includes(key.toLowerCase())) {
      if (maskedData[key] && typeof maskedData[key] === 'string') {
        // For strings, mask all but first and last character
        const value = maskedData[key];
        if (value.length > 2) {
          maskedData[key] = value[0] + '********' + value[value.length - 1];
        } else {
          maskedData[key] = '********';
        }
      } else if (maskedData[key]) {
        // For other types, just indicate it's hidden
        maskedData[key] = '[REDACTED]';
      }
    } else if (typeof maskedData[key] === 'object' && maskedData[key] !== null) {
      // Recursively mask nested objects
      maskedData[key] = maskSensitiveData(maskedData[key]);
    }
  }
  
  return maskedData;
};

/**
 * Log a message to the debug file
 * 
 * @param {string} message - Message to log
 * @param {object} data - Optional data to log
 */
exports.log = async (message, data = null) => {
  try {
    const timestamp = new Date().toISOString();
    let logEntry = `[${timestamp}] ${message}\n`;
    
    if (data) {
      try {
        // Mask any sensitive data before logging
        const maskedData = maskSensitiveData(data);
        logEntry += `DATA: ${JSON.stringify(maskedData, null, 2)}\n`;
      } catch (e) {
        logEntry += `DATA: [Cannot stringify] ${typeof data}\n`;
      }
    }
    
    await fs.appendFile(LOG_FILE, logEntry);
    
    // Also log to console in development mode, with masked data
    if (process.env.NODE_ENV === 'development') {
      console.log(message, data ? maskSensitiveData(data) : '');
    }
  } catch (error) {
    console.error(`Failed to write to log file: ${error.message}`);
  }
};

/**
 * Log an error to the debug file
 * 
 * @param {string} context - Error context
 * @param {Error} error - Error object
 */
exports.logError = async (context, error) => {
  try {
    const timestamp = new Date().toISOString();
    
    // Sanitize the error message to mask any potential sensitive information
    const sanitizedMessage = error.message ? maskSensitiveDataInString(error.message) : 'Unknown error';
    let logEntry = `[${timestamp}] ERROR in ${context}: ${sanitizedMessage}\n`;
    
    if (error.stack) {
      // Also sanitize the stack trace
      const sanitizedStack = maskSensitiveDataInString(error.stack);
      logEntry += `STACK: ${sanitizedStack}\n`;
    }
    
    await fs.appendFile(LOG_FILE, logEntry);
    
    // Also log to console in development mode
    if (process.env.NODE_ENV === 'development') {
      // Create a new error object with sanitized message to avoid exposing sensitive data
      const sanitizedError = new Error(sanitizedMessage);
      if (error.stack) sanitizedError.stack = maskSensitiveDataInString(error.stack);
      console.error(`ERROR in ${context}:`, sanitizedError);
    }
  } catch (err) {
    console.error(`Failed to write error to log file: ${err.message}`);
  }
};

/**
 * Mask sensitive data that might appear in error messages or stack traces
 * 
 * @param {string} text - The text to sanitize
 * @returns {string} - Sanitized text
 */
function maskSensitiveDataInString(text) {
  if (!text) return text;
  
  // Mask potential password parameters in URLs
  text = text.replace(/(password|pwd|passwd|pass)=([^&\s]+)/gi, '$1=********');
  
  // Mask potential private keys, tokens, or auth strings
  text = text.replace(/(auth|token|key|secret)=([^&\s]+)/gi, '$1=********');
  
  // Mask potential basic auth in URLs
  text = text.replace(/(https?:\/\/)([^:]+):([^@]+)@/gi, '$1$2:********@');
  
  return text;
}

/**
 * Get the contents of the debug log
 * 
 * @returns {Promise<string>} - Log contents
 */
exports.getLogContents = async () => {
  try {
    await initLogFile();
    return await fs.readFile(LOG_FILE, 'utf8');
  } catch (error) {
    console.error(`Failed to read log file: ${error.message}`);
    return `Error reading log file: ${error.message}`;
  }
};

/**
 * Clear the debug log
 */
exports.clearLog = async () => {
  try {
    await fs.writeFile(LOG_FILE, '--- WebtunelCMounter Debug Log ---\n');
  } catch (error) {
    console.error(`Failed to clear log file: ${error.message}`);
  }
};