import React from 'react';
import { Modal, Typography, List, Divider, Space, Collapse, Alert } from 'antd';
import { InfoCircleOutlined, LinkOutlined, QuestionCircleOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;
const { Panel } = Collapse;

const HelpSection = ({ visible, onClose }) => {
  return (
    <Modal
      title={
        <Space>
          <QuestionCircleOutlined />
          <span>How to Connect to Cloud Services</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={700}
      bodyStyle={{ maxHeight: '70vh', overflow: 'auto' }}
    >
      <Typography>
        <Paragraph>
          MacCloudMounter allows you to easily connect to various cloud storage services and mount them
          as local drives on your Mac. Below is a guide on how to set up connections for each supported protocol.
        </Paragraph>

        <Alert
          message="Important Note"
          description="All mounted services will appear in Finder under /Volumes. You can safely disconnect them by either clicking 'Unmount' in the app or ejecting the volume in Finder."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Collapse defaultActiveKey={['ftp']}>
          <Panel header="FTP (File Transfer Protocol)" key="ftp">
            <Title level={5}>Connection Details</Title>
            <List itemLayout="horizontal">
              <List.Item>
                <List.Item.Meta
                  title="Host"
                  description="Enter the FTP server address (e.g., ftp.example.com or IP address)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Port"
                  description="Default is 21. Only change if your server uses a non-standard port."
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Username"
                  description="Your FTP username. Use 'anonymous' for public FTP servers."
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Password"
                  description="Your FTP password. For anonymous login, you can use your email or leave it blank."
                />
              </List.Item>
            </List>
            <Divider />
            <Title level={5}>Notes</Title>
            <Paragraph>
              <ul>
                <li>FTP transfers data in plain text, making it less secure than other protocols.</li>
                <li>Many public FTP servers accept anonymous logins.</li>
                <li>FTP works well for basic file transfers but lacks encryption.</li>
              </ul>
            </Paragraph>
          </Panel>

          <Panel header="SFTP (SSH File Transfer Protocol)" key="sftp">
            <Title level={5}>Connection Details</Title>
            <List itemLayout="horizontal">
              <List.Item>
                <List.Item.Meta
                  title="Host"
                  description="Enter the SFTP server address (e.g., sftp.example.com or IP address)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Port"
                  description="Default is 22. Only change if your server uses a non-standard port."
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Username"
                  description="Your SSH/SFTP username"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Password"
                  description="Your SSH/SFTP password (not needed if using a private key)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Private Key (optional)"
                  description="Path to your SSH private key file. Click 'Browse' to select from your filesystem."
                />
              </List.Item>
            </List>
            <Divider />
            <Title level={5}>Notes</Title>
            <Paragraph>
              <ul>
                <li>SFTP offers secure encrypted file transfers over SSH.</li>
                <li>Private key authentication is more secure than password authentication.</li>
                <li>Make sure your private key has the correct permissions (chmod 600).</li>
                <li>SFTP is widely supported on Linux/Unix servers and many hosting providers.</li>
              </ul>
            </Paragraph>
          </Panel>

          <Panel header="Samba (SMB)" key="samba">
            <Title level={5}>Connection Details</Title>
            <List itemLayout="horizontal">
              <List.Item>
                <List.Item.Meta
                  title="Host"
                  description="Enter the SMB server address (e.g., fileserver.local or IP address)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Port"
                  description="Default is 445. Only change if your server uses a non-standard port."
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Share Name"
                  description="The name of the shared folder (e.g., 'documents' or 'media')"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Domain (optional)"
                  description="Windows domain name if applicable. For home networks, you can usually leave this as WORKGROUP."
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Username"
                  description="Your SMB username (may need to be in format DOMAIN\\username for Windows domains)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Password"
                  description="Your SMB password"
                />
              </List.Item>
            </List>
            <Divider />
            <Title level={5}>Notes</Title>
            <Paragraph>
              <ul>
                <li>SMB is commonly used for Windows file sharing and NAS devices.</li>
                <li>For macOS to macOS file sharing, SMB is the preferred protocol.</li>
                <li>If connecting to a Windows computer, make sure file sharing is enabled and the firewall allows SMB connections.</li>
                <li>For home networks, you may be able to browse available shares in Finder before setting up the connection.</li>
              </ul>
            </Paragraph>
          </Panel>

          <Panel header="WebDAV" key="webdav">
            <Title level={5}>Connection Details</Title>
            <List itemLayout="horizontal">
              <List.Item>
                <List.Item.Meta
                  title="WebDAV URL"
                  description="The complete URL to the WebDAV server (e.g., https://webdav.example.com/remote.php/dav/files/username/)"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Username"
                  description="Your WebDAV username"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Password"
                  description="Your WebDAV password"
                />
              </List.Item>
            </List>
            <Divider />
            <Title level={5}>Common WebDAV Services</Title>
            <List itemLayout="horizontal">
              <List.Item>
                <List.Item.Meta
                  title="Nextcloud"
                  description="https://your-nextcloud-server.com/remote.php/dav/files/username/"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="ownCloud"
                  description="https://your-owncloud-server.com/remote.php/dav/files/username/"
                />
              </List.Item>
              <List.Item>
                <List.Item.Meta
                  title="Box"
                  description="https://dav.box.com/dav"
                />
              </List.Item>
            </List>
            <Divider />
            <Title level={5}>Notes</Title>
            <Paragraph>
              <ul>
                <li>WebDAV works over HTTP/HTTPS, making it firewall-friendly.</li>
                <li>Always use HTTPS URLs when possible for security.</li>
                <li>Performance may be slower than other protocols for large file transfers.</li>
                <li>WebDAV is commonly used by cloud storage services, content management systems, and collaborative platforms.</li>
              </ul>
            </Paragraph>
          </Panel>
        </Collapse>

        <Divider />
        
        <Title level={4}>Troubleshooting</Title>
        <Collapse>
          <Panel header="Connection Issues" key="connection">
            <List>
              <List.Item>
                <Text strong>Check your internet connection</Text> - Make sure your Mac is connected to the internet.
              </List.Item>
              <List.Item>
                <Text strong>Verify server address</Text> - Double-check the hostname or IP address.
              </List.Item>
              <List.Item>
                <Text strong>Confirm credentials</Text> - Make sure your username and password are correct.
              </List.Item>
              <List.Item>
                <Text strong>Check firewall settings</Text> - Ensure your firewall isn't blocking the connection.
              </List.Item>
              <List.Item>
                <Text strong>VPN conflicts</Text> - If you're using a VPN, it might interfere with certain connections.
              </List.Item>
            </List>
          </Panel>
          
          <Panel header="Mount Fails" key="mount">
            <List>
              <List.Item>
                <Text strong>Check permissions</Text> - Make sure your account has sufficient permissions on the server.
              </List.Item>
              <List.Item>
                <Text strong>Volume already exists</Text> - Check if the volume name is already in use at /Volumes.
              </List.Item>
              <List.Item>
                <Text strong>Server timeouts</Text> - The server might be too slow to respond or under heavy load.
              </List.Item>
              <List.Item>
                <Text strong>View logs</Text> - Click the Debug button in the app to see more detailed error information.
              </List.Item>
            </List>
          </Panel>
          
          <Panel header="Performance Issues" key="performance">
            <List>
              <List.Item>
                <Text strong>Network speed</Text> - Slow internet connections will affect performance, especially for large files.
              </List.Item>
              <List.Item>
                <Text strong>Protocol limitations</Text> - WebDAV tends to be slower than direct protocols like SMB.
              </List.Item>
              <List.Item>
                <Text strong>Server load</Text> - High server load can cause slower responses.
              </List.Item>
              <List.Item>
                <Text strong>Distance to server</Text> - Geographic distance increases latency.
              </List.Item>
            </List>
          </Panel>
        </Collapse>
      </Typography>
    </Modal>
  );
};

export default HelpSection;