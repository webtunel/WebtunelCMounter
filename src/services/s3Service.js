/**
 * S3 Service for mounting Amazon S3 buckets
 * Uses s3fs-fuse to mount S3 buckets as local filesystems
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const util = require('util');
const debugUtils = require('../utils/debugUtils');
const execPromise = util.promisify(exec);

/**
 * Mount an S3 bucket using s3fs-fuse
 * 
 * @param {string} bucket - The S3 bucket name
 * @param {string} region - AWS region (e.g., 'us-east-1')
 * @param {string} accessKeyId - AWS access key ID
 * @param {string} secretAccessKey - AWS secret access key
 * @param {string} mountPoint - Local directory where to mount the bucket
 * @returns {Promise<string>} - A promise that resolves to a success message
 */
async function mount(bucket, region, accessKeyId, secretAccessKey, mountPoint) {
  try {
    // Log the mount attempt (excluding credentials)
    await debugUtils.log('Attempting to mount S3 bucket', { bucket, region, mountPoint });
    
    // Validate inputs
    if (!bucket) throw new Error('Bucket name is required');
    if (!region) throw new Error('Region is required');
    if (!accessKeyId) throw new Error('Access Key ID is required');
    if (!secretAccessKey) throw new Error('Secret Access Key is required');
    if (!mountPoint) throw new Error('Mount point is required');
    
    // Check if s3fs-fuse is installed
    try {
      await execPromise('which s3fs');
    } catch (error) {
      await debugUtils.logError('s3fs-fuse not installed', error);
      throw new Error('s3fs-fuse is not installed. Please install s3fs-fuse to mount S3 buckets.');
    }
    
    // Create mount point if it doesn't exist
    if (!fs.existsSync(mountPoint)) {
      await debugUtils.log(`Creating mount point directory: ${mountPoint}`);
      fs.mkdirSync(mountPoint, { recursive: true });
    }
    
    // Store credentials temporarily in a secure way (password will be passed via environment variable)
    const credentials = `${accessKeyId}:${secretAccessKey}`;
    
    // Mount options including security and performance settings
    const mountOptions = [
      'use_path_request_style',      // Path-style S3 URLs
      'url=https://s3.amazonaws.com', // S3 endpoint URL
      'use_cache=/tmp',              // Enable local cache for better performance
      'allow_other',                 // Allow access to other users
      `region=${region}`,            // AWS region
      'enable_noobj_cache',          // Cache non-existent objects
      'enable_content_md5',          // Verify content integrity
      'umask=022',                   // Default permissions
      'dbglevel=warn',               // Debug level
      'retries=5',                   // Number of retries
      'connect_timeout=30'           // Connection timeout
    ].join(',');
    
    // Command to mount the bucket
    const command = `AWSACCESSKEYID="${accessKeyId}" AWSSECRETACCESSKEY="${secretAccessKey}" s3fs ${bucket} ${mountPoint} -o ${mountOptions}`;
    
    // Execute mount command
    await debugUtils.log(`Executing S3 mount command for bucket ${bucket} to ${mountPoint}`);
    await execPromise(command);
    
    // Verify the mount was successful
    await execPromise(`ls -la ${mountPoint}`);
    
    await debugUtils.log(`Successfully mounted S3 bucket ${bucket} at ${mountPoint}`);
    return `Successfully mounted S3 bucket ${bucket} at ${mountPoint}`;
  } catch (error) {
    await debugUtils.logError('Error mounting S3 bucket', error);
    throw error;
  }
}

module.exports = {
  mount
};