const express = require('express');
const ftpService = require('./services/ftpService');
const sftpService = require('./services/sftpService');
const sambaService = require('./services/sambaService');
const webdavService = require('./services/webdavService');
const mountController = require('./controllers/mountController');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Routes
app.post('/mount/ftp', mountController.mountFTP);
app.post('/mount/sftp', mountController.mountSFTP);
app.post('/mount/samba', mountController.mountSamba);
app.post('/mount/webdav', mountController.mountWebDAV);
app.post('/unmount', mountController.unmount);
app.get('/mounts', mountController.listMounts);

app.listen(PORT, () => {
  console.log(`MacCloudMounter server listening on port ${PORT}`);
});