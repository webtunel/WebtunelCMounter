import React, { useState } from 'react';
import { Row, Col, List, Button, Card, Form, Input, Select, Space, Typography, Divider } from 'antd';
import { LinkOutlined, DeleteOutlined, SaveOutlined, PlusOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { Option } = Select;

const ConnectionsTab = ({
  connections,
  setConnections,
  mounts,
  loadMounts,
  showNotification,
  setStatusMessage,
  switchToMountsTab
}) => {
  const [form] = Form.useForm();
  const [currentConnectionName, setCurrentConnectionName] = useState(null);
  const [isNewConnection, setIsNewConnection] = useState(true);
  const [connectionType, setConnectionType] = useState('ftp');

  // Reset form and create new connection
  const handleNewConnection = () => {
    form.resetFields();
    setCurrentConnectionName(null);
    setIsNewConnection(true);
    setConnectionType('ftp');
  };

  // Load connection data into form
  const handleSelectConnection = (connectionName) => {
    const connection = connections.find(conn => conn.name === connectionName);
    if (connection) {
      setCurrentConnectionName(connectionName);
      setIsNewConnection(false);
      setConnectionType(connection.type);
      
      form.setFieldsValue({
        name: connection.name,
        type: connection.type,
        host: connection.host || '',
        port: connection.port || '',
        url: connection.url || '',
        share: connection.share || '',
        domain: connection.domain || '',
        username: connection.username || '',
        password: connection.password || '',
        privateKey: connection.privateKey || '',
      });
    }
  };

  // Handle connection type change
  const handleTypeChange = (value) => {
    setConnectionType(value);
  };

  // Save connection
  const handleSaveConnection = async (values) => {
    // Create basic connection data
    const connectionData = {
      name: values.name.trim(),
      type: values.type
    };
    
    // Add type-specific fields
    if (connectionData.type === 'webdav') {
      connectionData.url = values.url?.trim();
    } else if (connectionData.type === 's3') {
      connectionData.bucket = values.bucket?.trim();
      connectionData.region = values.region?.trim();
      connectionData.accessKeyId = values.accessKeyId?.trim();
      connectionData.secretAccessKey = values.secretAccessKey;
    } else {
      connectionData.host = values.host?.trim();
      connectionData.port = values.port ? parseInt(values.port) : null;
      
      if (connectionData.type === 'samba') {
        connectionData.share = values.share?.trim();
        connectionData.domain = values.domain?.trim();
      }
    }
    
    // Add authentication
    connectionData.username = values.username?.trim();
    connectionData.password = values.password;
    
    if (connectionData.type === 'sftp' && values.privateKey) {
      connectionData.privateKey = values.privateKey.trim();
    }
    
    // Validate required fields (should be handled by Form validation as well)
    if (!connectionData.name) {
      showNotification('Connection name is required', 'error');
      return;
    }
    
    if (connectionData.type === 'webdav' && !connectionData.url) {
      showNotification('WebDAV URL is required', 'error');
      return;
    } else if (connectionData.type === 's3') {
      if (!connectionData.bucket) {
        showNotification('S3 bucket name is required', 'error');
        return;
      }
      if (!connectionData.region) {
        showNotification('AWS region is required', 'error');
        return;
      }
      if (!connectionData.accessKeyId) {
        showNotification('Access Key ID is required', 'error');
        return;
      }
      if (!connectionData.secretAccessKey) {
        showNotification('Secret Access Key is required', 'error');
        return;
      }
    } else if (connectionData.type !== 'webdav' && !connectionData.host) {
      showNotification('Host is required', 'error');
      return;
    }
    
    if (connectionData.type === 'samba' && !connectionData.share) {
      showNotification('Share name is required', 'error');
      return;
    }
    
    setStatusMessage('Saving connection...');
    
    try {
      const updatedConnections = await window.api.saveConnection(connectionData);
      setConnections(updatedConnections);
      showNotification(`Connection "${connectionData.name}" saved successfully`);
      handleNewConnection(); // Reset form after save
      setStatusMessage('Ready');
    } catch (error) {
      showNotification(`Failed to save connection: ${error.message}`, 'error');
      setStatusMessage('Error saving connection');
    }
  };

  // Delete connection
  const handleDeleteConnection = async () => {
    if (!currentConnectionName) return;
    
    setStatusMessage('Deleting connection...');
    
    try {
      const updatedConnections = await window.api.removeConnection(currentConnectionName);
      setConnections(updatedConnections);
      showNotification(`Connection "${currentConnectionName}" deleted`);
      handleNewConnection(); // Reset form after delete
      setStatusMessage('Ready');
    } catch (error) {
      showNotification(`Failed to delete connection: ${error.message}`, 'error');
      setStatusMessage('Error deleting connection');
    }
  };

  // Mount connection
  const handleMountConnection = async (connectionName) => {
    const connection = connections.find(conn => conn.name === connectionName || conn.name === currentConnectionName);
    if (!connection) return;
    
    setStatusMessage(`Mounting ${connection.name}...`);
    
    try {
      // Generate system mount point
      const systemMountPoint = generateMountPoint(connection);
      
      // Create a copy of connection with generated mount point
      const connectionWithMountPoint = {
        ...connection,
        mountPoint: systemMountPoint
      };
      
      const result = await window.api.mountConnection(connectionWithMountPoint);
      
      if (result.success) {
        showNotification(`Successfully mounted "${connection.name}"`);
        setStatusMessage('Ready');
        
        // Switch to active mounts tab
        switchToMountsTab();
        
        // Refresh mounts list
        loadMounts();
      } else {
        showNotification(`Failed to mount: ${result.error}`, 'error');
        setStatusMessage('Error mounting connection');
      }
    } catch (error) {
      showNotification(`Failed to mount: ${error.message}`, 'error');
      setStatusMessage('Error mounting connection');
    }
  };

  // Helper function to generate mount point
  const generateMountPoint = (connection) => {
    let mountName = '';
    
    // Generate mount point name based on connection type
    if (connection.type === 'webdav') {
      // Extract hostname from URL
      try {
        const url = new URL(connection.url);
        mountName = url.hostname;
      } catch (e) {
        // If URL parsing fails, use connection name
        mountName = connection.name;
      }
    } else if (connection.type === 'samba') {
      // For Samba, use the share name
      mountName = connection.share || connection.host;
    } else if (connection.type === 's3') {
      // For S3, use the bucket name
      mountName = `s3-${connection.bucket}`;
    } else {
      // For FTP/SFTP, use host
      mountName = connection.host;
    }
    
    // Clean up the name to be filesystem-friendly
    mountName = mountName.replace(/[^a-zA-Z0-9-_.]/g, '-');
    
    // Return the system Volumes path
    return `/Volumes/${mountName}`;
  };

  // Check if connection is mounted
  const isConnectionMounted = (connection) => {
    return mounts.some(mount => 
      mount.type === connection.type && 
      (
        (connection.type === 'webdav' && mount.url === connection.url) ||
        (connection.type === 's3' && mount.bucket === connection.bucket) ||
        (connection.type !== 'webdav' && connection.type !== 's3' && 
          mount.host === connection.host &&
          (connection.type !== 'samba' || mount.share === connection.share))
      )
    );
  };

  // Get connection icon and styling
  const getConnectionTypeInfo = (type) => {
    switch (type) {
      case 'ftp':
        return { label: 'FTP', className: 'icon-ftp' };
      case 'sftp':
        return { label: 'SFTP', className: 'icon-sftp' };
      case 'samba':
        return { label: 'SMB', className: 'icon-samba' };
      case 'webdav':
        return { label: 'DAV', className: 'icon-webdav' };
      case 's3':
        return { label: 'S3', className: 'icon-s3' };
      default:
        return { label: 'Unknown', className: '' };
    }
  };

  return (
    <Row gutter={16} className="connection-layout">
      <Col xs={24} sm={24} md={8} lg={6} className="connection-sidebar">
        <Card
          title="Saved Connections"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleNewConnection}
              size="middle"
            >
              New
            </Button>
          }
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '12px 16px', maxHeight: '60vh', overflow: 'auto' }}
        >
          <List
            dataSource={connections}
            renderItem={connection => {
              const typeInfo = getConnectionTypeInfo(connection.type);
              const isMounted = isConnectionMounted(connection);
              
              let serverDetails = '';
              if (connection.type === 'webdav') {
                serverDetails = connection.url || '';
              } else if (connection.type === 's3') {
                serverDetails = `${connection.bucket} (${connection.region})`;
              } else {
                serverDetails = connection.host || '';
                if (connection.type === 'samba' && connection.share) {
                  serverDetails += `/${connection.share}`;
                }
              }
              
              return (
                <List.Item
                  className={`connection-list-item ${currentConnectionName === connection.name ? 'active' : ''}`}
                  onClick={() => handleSelectConnection(connection.name)}
                  actions={[
                    isMounted ? null : 
                    <Button 
                      type="text" 
                      size="small" 
                      icon={<LinkOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMountConnection(connection.name);
                      }}
                    />,
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={
                      <div className={`connection-type-icon ${typeInfo.className}`}>
                        {typeInfo.label}
                      </div>
                    }
                    title={connection.name}
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {serverDetails}
                        {isMounted && <span className="mount-status" style={{ marginLeft: 5 }}></span>}
                      </Text>
                    }
                  />
                </List.Item>
              );
            }}
            locale={{ emptyText: 'No saved connections' }}
          />
        </Card>
      </Col>
      
      <Col xs={24} sm={24} md={16} lg={18} className="connection-content">
        <Card title={isNewConnection ? "New Connection" : `Edit: ${currentConnectionName}`}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSaveConnection}
            initialValues={{
              type: 'ftp',
            }}
          >
            <Row gutter={16}>
              <Col span={16}>
                <Form.Item
                  name="name"
                  label="Connection Name"
                  rules={[{ required: true, message: 'Please enter a connection name' }]}
                >
                  <Input />
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item
                  name="type"
                  label="Connection Type"
                  rules={[{ required: true }]}
                >
                  <Select onChange={handleTypeChange}>
                    <Option value="ftp">FTP</Option>
                    <Option value="sftp">SFTP</Option>
                    <Option value="samba">Samba (SMB)</Option>
                    <Option value="webdav">WebDAV</Option>
                    <Option value="s3">Amazon S3</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            <div className="form-section-title">Connection Details</div>
            
            {/* WebDAV-specific fields */}
            {connectionType === 'webdav' && (
              <Form.Item
                name="url"
                label="WebDAV URL"
                rules={[{ required: true, message: 'Please enter the WebDAV URL' }]}
              >
                <Input placeholder="https://example.com/dav" />
              </Form.Item>
            )}
            
            {/* Host & port for non-WebDAV */}
            {connectionType !== 'webdav' && (
              <Row gutter={16}>
                <Col span={16}>
                  <Form.Item
                    name="host"
                    label="Host"
                    rules={[{ required: true, message: 'Please enter the host' }]}
                  >
                    <Input placeholder="example.com or 192.168.1.1" />
                  </Form.Item>
                </Col>
                
                <Col span={8}>
                  <Form.Item
                    name="port"
                    label="Port"
                  >
                    <Input
                      type="number"
                      placeholder={
                        connectionType === 'ftp' ? '21' :
                        connectionType === 'sftp' ? '22' :
                        connectionType === 'samba' ? '445' : ''
                      }
                    />
                  </Form.Item>
                </Col>
              </Row>
            )}
            
            {/* Samba-specific fields */}
            {connectionType === 'samba' && (
              <>
                <Form.Item
                  name="share"
                  label="Share Name"
                  rules={[{ required: true, message: 'Please enter the share name' }]}
                >
                  <Input placeholder="shared" />
                </Form.Item>
                
                <Form.Item
                  name="domain"
                  label="Domain (optional)"
                >
                  <Input placeholder="WORKGROUP" />
                </Form.Item>
              </>
            )}
            
            <div className="form-section-title">Authentication</div>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="username"
                  label="Username"
                >
                  <Input placeholder="anonymous" />
                </Form.Item>
              </Col>
              
              <Col span={12}>
                <Form.Item
                  name="password"
                  label="Password"
                >
                  <Input.Password />
                </Form.Item>
              </Col>
            </Row>
            
            {/* SFTP-specific fields */}
            {connectionType === 'sftp' && (
              <Form.Item
                name="privateKey"
                label="Private Key (optional)"
              >
                <Input.Search
                  readOnly
                  enterButton="Browse..."
                  onSearch={async () => {
                    const file = await window.api.selectFile();
                    if (file) {
                      form.setFieldsValue({ privateKey: file });
                    }
                  }}
                />
              </Form.Item>
            )}
            
            {/* S3-specific fields */}
            {connectionType === 's3' && (
              <>
                <Row gutter={16}>
                  <Col span={16}>
                    <Form.Item
                      name="bucket"
                      label="Bucket Name"
                      rules={[{ required: true, message: 'Please enter the S3 bucket name' }]}
                    >
                      <Input placeholder="my-bucket" />
                    </Form.Item>
                  </Col>
                  
                  <Col span={8}>
                    <Form.Item
                      name="region"
                      label="AWS Region"
                      rules={[{ required: true, message: 'Please enter the AWS region' }]}
                    >
                      <Input placeholder="us-east-1" />
                    </Form.Item>
                  </Col>
                </Row>
                
                <div className="form-section-title">AWS Authentication</div>
                
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="accessKeyId"
                      label="Access Key ID"
                      rules={[{ required: true, message: 'Please enter your Access Key ID' }]}
                    >
                      <Input placeholder="AKIAIOSFODNN7EXAMPLE" />
                    </Form.Item>
                  </Col>
                  
                  <Col span={12}>
                    <Form.Item
                      name="secretAccessKey"
                      label="Secret Access Key"
                      rules={[{ required: true, message: 'Please enter your Secret Access Key' }]}
                    >
                      <Input.Password placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" />
                    </Form.Item>
                  </Col>
                </Row>
              </>
            )}
            
            <div className="form-actions">
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SaveOutlined />}
                >
                  Save Connection
                </Button>
                
                {!isNewConnection && (
                  <>
                    <Button
                      type="primary"
                      icon={<LinkOutlined />}
                      onClick={() => handleMountConnection()}
                      disabled={isConnectionMounted(connections.find(c => c.name === currentConnectionName))}
                    >
                      Mount
                    </Button>
                    
                    <Button onClick={handleNewConnection}>
                      Cancel
                    </Button>
                    
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={handleDeleteConnection}
                    >
                      Delete
                    </Button>
                  </>
                )}
              </Space>
            </div>
          </Form>
        </Card>
      </Col>
    </Row>
  );
};

export default ConnectionsTab;