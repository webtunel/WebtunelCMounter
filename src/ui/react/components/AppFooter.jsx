import React from 'react';
import { Layout, Space, Typography } from 'antd';
import { CheckCircleOutlined, SyncOutlined, WarningOutlined } from '@ant-design/icons';

const { Footer } = Layout;
const { Text } = Typography;

const AppFooter = ({ statusMessage }) => {
  // Determine status type based on message content
  const getStatusType = () => {
    if (statusMessage.toLowerCase().includes('loading') || 
        statusMessage.toLowerCase().includes('connecting') ||
        statusMessage.toLowerCase().includes('mounting')) {
      return 'loading';
    } else if (statusMessage.toLowerCase().includes('error') || 
               statusMessage.toLowerCase().includes('failed')) {
      return 'error';
    } else {
      return 'success';
    }
  };

  const statusType = getStatusType();
  
  // Get the appropriate icon based on status type
  const getStatusIcon = () => {
    switch (statusType) {
      case 'loading':
        return <SyncOutlined spin style={{ color: '#FF9500' }} />;
      case 'error':
        return <WarningOutlined style={{ color: '#FF3B30' }} />;
      default:
        return <CheckCircleOutlined style={{ color: '#28CD41' }} />;
    }
  };

  return (
    <Footer className="app-footer">
      <div className="app-status">
        {getStatusIcon()}
        <Text 
          type={statusType === 'error' ? 'danger' : undefined}
          style={{ 
            color: statusType === 'loading' ? '#FF9500' : undefined,
            fontWeight: statusType !== 'success' ? 500 : 400
          }}
        >
          {statusMessage}
        </Text>
      </div>
      <Text type="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
        © {new Date().getFullYear()} MacCloudMounter
      </Text>
    </Footer>
  );
};

export default AppFooter;