import React from 'react';
import { Table, Card, Button, Empty, Typography, Space, Tag } from 'antd';
import { LinkOutlined, FolderOpenOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ActiveMountsTab = ({
  mounts,
  loadMounts,
  showNotification,
  setStatusMessage
}) => {
  // Unmount a filesystem
  const handleUnmount = async (mountPoint) => {
    if (!mountPoint) return;
    
    setStatusMessage(`Unmounting ${mountPoint}...`);
    
    try {
      const result = await window.api.unmountConnection(mountPoint);
      
      if (result.success) {
        showNotification(`Successfully unmounted "${mountPoint}"`);
        setStatusMessage('Ready');
        
        // Refresh mounts list
        loadMounts();
      } else {
        showNotification(`Failed to unmount: ${result.error}`, 'error');
        setStatusMessage('Error unmounting filesystem');
      }
    } catch (error) {
      showNotification(`Failed to unmount: ${error.message}`, 'error');
      setStatusMessage('Error unmounting filesystem');
    }
  };

  // Open mount point in Finder
  const handleOpenInFinder = (mountPoint) => {
    if (!mountPoint) return;
    
    setStatusMessage(`Opening ${mountPoint} in Finder...`);
    window.api.selectDirectory(mountPoint)
      .then(() => {
        setStatusMessage('Ready');
      })
      .catch(error => {
        console.error('Error opening in Finder:', error);
        setStatusMessage('Ready');
      });
  };

  // Format date in a user-friendly way
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp);
    
    // Format date in macOS style: Today at 12:34 PM or May 7 at 12:34 PM
    const now = new Date();
    const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
    
    const timeOptions = { hour: 'numeric', minute: 'numeric', hour12: true };
    const time = date.toLocaleTimeString(undefined, timeOptions);
    
    if (isToday) {
      return `Today at ${time}`;
    } else {
      const dateOptions = { month: 'short', day: 'numeric' };
      const dateStr = date.toLocaleDateString(undefined, dateOptions);
      return `${dateStr} at ${time}`;
    }
  };

  // Table columns configuration
  const columns = [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: () => <span className="mount-status" title="Connected"></span>,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: type => <Tag color="blue">{type.toUpperCase()}</Tag>,
    },
    {
      title: 'Server/URL',
      dataIndex: 'serverInfo',
      key: 'serverInfo',
      render: (_, record) => {
        if (record.type === 'webdav') {
          return record.url || '';
        } else if (record.type === 'samba') {
          return `${record.host}/${record.share}`;
        } else {
          return record.host || '';
        }
      },
    },
    {
      title: 'Mount Point',
      dataIndex: 'mountPoint',
      key: 'mountPoint',
      ellipsis: true,
    },
    {
      title: 'Mounted At',
      dataIndex: 'timestamp',
      key: 'timestamp',
      render: timestamp => formatDate(timestamp),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            icon={<LinkOutlined />}
            onClick={() => handleUnmount(record.mountPoint)}
            danger
            size="small"
          >
            Unmount
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={() => handleOpenInFinder(record.mountPoint)}
            type="primary"
            size="small"
          >
            Open
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <Card title="Currently Mounted Filesystems">
      {mounts.length > 0 ? (
        <Table
          dataSource={mounts}
          columns={columns}
          rowKey="mountPoint"
          pagination={false}
          size="middle"
        />
      ) : (
        <Empty
          description="No active mounts"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Text type="secondary">
            Go to Connections tab to mount a filesystem
          </Text>
        </Empty>
      )}
    </Card>
  );
};

export default ActiveMountsTab;