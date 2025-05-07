import React from 'react';
import { notification } from 'antd';
import { 
  CheckCircleFilled, 
  InfoCircleFilled, 
  WarningFilled, 
  CloseCircleFilled 
} from '@ant-design/icons';

// Custom notification component with improved styling
const Notification = ({ visible, message, type, onClose }) => {
  // Get appropriate icon based on notification type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircleFilled style={{ color: '#28CD41' }} />;
      case 'info':
        return <InfoCircleFilled style={{ color: '#007AFF' }} />;
      case 'warning':
        return <WarningFilled style={{ color: '#FF9500' }} />;
      case 'error':
        return <CloseCircleFilled style={{ color: '#FF3B30' }} />;
      default:
        return <InfoCircleFilled style={{ color: '#007AFF' }} />;
    }
  };

  // Get title based on notification type
  const getTitle = () => {
    switch (type) {
      case 'success':
        return 'Success';
      case 'info':
        return 'Information';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Error';
      default:
        return 'Notification';
    }
  };

  React.useEffect(() => {
    if (visible && message) {
      // Use the notification API with custom styling
      notification.open({
        message: getTitle(),
        description: message,
        icon: getIcon(),
        placement: 'topRight',
        duration: 5,
        className: `notification notification-${type}`,
        onClose,
        style: {
          borderRadius: '12px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.1)',
        }
      });
    }
  }, [visible, message, type, onClose]);

  // This component doesn't render anything directly, just triggers notifications
  return null;
};

export default Notification;