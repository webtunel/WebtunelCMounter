const ftpService = require('../services/ftpService');
const sftpService = require('../services/sftpService');
const sambaService = require('../services/sambaService');
const webdavService = require('../services/webdavService');
const mountUtils = require('../utils/mountUtils');

/**
 * Mount an FTP server
 */
exports.mountFTP = async (req, res) => {
  try {
    const { host, port, username, password, mountPoint } = req.body;
    
    if (!host || !mountPoint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await ftpService.mount(host, port || 21, username || 'anonymous', password || '', mountPoint);
    res.json({ success: true, mountPoint, message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mount an SFTP server
 */
exports.mountSFTP = async (req, res) => {
  try {
    const { host, port, username, password, privateKey, mountPoint } = req.body;
    
    if (!host || !username || !mountPoint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await sftpService.mount(host, port || 22, username, password, privateKey, mountPoint);
    res.json({ success: true, mountPoint, message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mount a Samba share
 */
exports.mountSamba = async (req, res) => {
  try {
    const { host, share, username, password, domain, mountPoint } = req.body;
    
    if (!host || !share || !mountPoint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await sambaService.mount(host, share, username, password, domain, mountPoint);
    res.json({ success: true, mountPoint, message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Mount a WebDAV server
 */
exports.mountWebDAV = async (req, res) => {
  try {
    const { url, username, password, mountPoint } = req.body;
    
    if (!url || !mountPoint) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    const result = await webdavService.mount(url, username, password, mountPoint);
    res.json({ success: true, mountPoint, message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Unmount a previously mounted filesystem
 */
exports.unmount = async (req, res) => {
  try {
    const { mountPoint } = req.body;
    
    if (!mountPoint) {
      return res.status(400).json({ error: 'Missing mountPoint parameter' });
    }
    
    const result = await mountUtils.unmount(mountPoint);
    res.json({ success: true, message: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * List all current mounts
 */
exports.listMounts = async (req, res) => {
  try {
    const mounts = await mountUtils.listMounts();
    res.json({ mounts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};