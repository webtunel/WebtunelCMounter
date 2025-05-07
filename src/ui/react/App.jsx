import React, { useState, useEffect } from 'react';
import { Layout, Tabs, ConfigProvider, theme, Button, Tooltip, Space, Typography, Row, Col } from 'antd';
import { BugOutlined, CloudOutlined, ReloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import ConnectionsTab from './components/ConnectionsTab';
import ActiveMountsTab from './components/ActiveMountsTab';
import Notification from './components/Notification';
import AppFooter from './components/AppFooter';
import DebugViewer from './components/DebugViewer';
import HelpSection from './components/HelpSection';
import './styles/modern-ui.css'; // Import the new modern UI styles

const { Content } = Layout;
const { Title } = Typography;

const App = () => {
  const [activeTab, setActiveTab] = useState('connections');
  const [connections, setConnections] = useState([]);
  const [mounts, setMounts] = useState([]);
  const [notification, setNotification] = useState({ visible: false, message: '', type: 'success' });
  const [statusMessage, setStatusMessage] = useState('Ready');
  const [debugModalVisible, setDebugModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load connections on mount
  useEffect(() => {
    loadConnections();
    
    // Listen for resize events
    window.addEventListener('resize', handleResize);
    
    // Listen for menu events
    window.api.onShowDebugLogs(() => {
      setDebugModalVisible(true);
    });
    
    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
      window.api.removeAllListeners();
    };
  }, []);

  // Responsive layout handler
  const handleResize = () => {
    // This function will trigger re-renders on window resize
    // We'll use CSS media queries for the actual responsive behavior
  };

  // Load active mounts when switching to that tab
  useEffect(() => {
    if (activeTab === 'active-mounts') {
      loadMounts();
    }
  }, [activeTab]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      setStatusMessage('Loading connections...');
      const savedConnections = await window.api.getSavedConnections();
      setConnections(savedConnections);
      setStatusMessage('Ready');
    } catch (error) {
      console.error('Error loading connections:', error);
      showNotification('Failed to load connections', 'error');
      setStatusMessage('Error loading connections');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMounts = async () => {
    try {
      setIsLoading(true);
      setStatusMessage('Loading active mounts...');
      const result = await window.api.getMounts();
      
      if (result.success) {
        setMounts(result.mounts || []);
        setStatusMessage('Ready');
      } else {
        showNotification(`Failed to load mounts: ${result.error}`, 'error');
        setStatusMessage('Error loading mounts');
      }
    } catch (error) {
      showNotification(`Failed to load mounts: ${error.message}`, 'error');
      setStatusMessage('Error loading mounts');
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({
      visible: true,
      message,
      type
    });
    
    // Hide after 5 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 5000);
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
  };

  const handleRefresh = () => {
    if (activeTab === 'connections') {
      loadConnections();
    } else if (activeTab === 'active-mounts') {
      loadMounts();
    }
  };

  // Tabs content
  const renderTabContent = () => {
    if (activeTab === 'connections') {
      return (
        <ConnectionsTab
          connections={connections}
          setConnections={setConnections}
          mounts={mounts}
          loadMounts={loadMounts}
          showNotification={showNotification}
          setStatusMessage={setStatusMessage}
          switchToMountsTab={() => setActiveTab('active-mounts')}
          isLoading={isLoading}
        />
      );
    } else {
      return (
        <ActiveMountsTab
          mounts={mounts}
          loadMounts={loadMounts}
          showNotification={showNotification}
          setStatusMessage={setStatusMessage}
          isLoading={isLoading}
        />
      );
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#007bff', // Primary blue color for modern UI
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
      }}
    >
      <Layout className="app-container">
        {/* Modern Header */}
        <div className="modern-header">
          <div className="header-logo">
            <CloudOutlined style={{ fontSize: 24, color: '#007bff' }} />
            <span>WebTunnelMounter</span>
          </div>
          <div className="header-actions">
            <Tooltip title="Refresh">
              <Button 
                icon={<ReloadOutlined />} 
                shape="circle"
                onClick={handleRefresh}
                loading={isLoading}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Help">
              <Button 
                icon={<QuestionCircleOutlined />} 
                shape="circle"
                onClick={() => setHelpModalVisible(true)}
                size="small"
              />
            </Tooltip>
            <Tooltip title="Debug">
              <Button 
                icon={<BugOutlined />} 
                shape="circle"
                onClick={() => setDebugModalVisible(true)}
                size="small"
              />
            </Tooltip>
          </div>
        </div>
        
        <Content className="modern-content">
          {/* Modern Tabs */}
          <div className="modern-tabs">
            <div 
              className={`modern-tab ${activeTab === 'connections' ? 'active' : ''}`}
              onClick={() => setActiveTab('connections')}
            >
              Connections
            </div>
            <div 
              className={`modern-tab ${activeTab === 'active-mounts' ? 'active' : ''}`}
              onClick={() => setActiveTab('active-mounts')}
            >
              Active Mounts
            </div>
          </div>
          
          {/* Tab Content */}
          {renderTabContent()}
        </Content>
        
        {/* Status Footer */}
        <div className="status-indicator">
          <div className={`status-dot ${isLoading ? 'loading' : ''}`}></div>
          <div className="status-text">{statusMessage}</div>
        </div>
        
        <Notification
          visible={notification.visible}
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(prev => ({ ...prev, visible: false }))}
        />
        
        <DebugViewer 
          visible={debugModalVisible}
          onClose={() => setDebugModalVisible(false)}
          className="debug-modal"
        />
        
        <HelpSection
          visible={helpModalVisible}
          onClose={() => setHelpModalVisible(false)}
        />
      </Layout>
    </ConfigProvider>
  );
};

export default App;