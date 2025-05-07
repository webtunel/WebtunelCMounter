import React, { useState, useEffect } from 'react';
import { Layout, Tabs, ConfigProvider, theme, Button, Tooltip, Space, Typography, Row, Col } from 'antd';
import { BugOutlined, CloudOutlined, ReloadOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import ConnectionsTab from './components/ConnectionsTab';
import ActiveMountsTab from './components/ActiveMountsTab';
import Notification from './components/Notification';
import AppFooter from './components/AppFooter';
import DebugViewer from './components/DebugViewer';
import HelpSection from './components/HelpSection';

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

  // Tabs configuration
  const tabItems = [
    {
      key: 'connections',
      label: 'Connections',
      children: (
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
      )
    },
    {
      key: 'active-mounts',
      label: 'Active Mounts',
      children: (
        <ActiveMountsTab
          mounts={mounts}
          loadMounts={loadMounts}
          showNotification={showNotification}
          setStatusMessage={setStatusMessage}
          isLoading={isLoading}
        />
      )
    }
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#007AFF', // Apple blue
          borderRadius: 8,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        },
        components: {
          Button: {
            controlHeight: 36,
            paddingInline: 16,
          },
          Card: {
            borderRadius: 12,
          },
          Table: {
            borderRadius: 12,
          },
          Modal: {
            borderRadius: 12,
          },
        },
      }}
    >
      <Layout className="app-container">
        {/* App Header */}
        <Row justify="space-between" align="middle" className="app-header" wrap={false}>
          <Col flex="1">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <CloudOutlined style={{ fontSize: 24, color: '#007AFF', marginRight: 8 }} />
              <Title level={4} style={{ margin: 0, fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                WebtunelCMounter
              </Title>
            </div>
          </Col>
          <Col>
            <Space size={6} align="center">
              <Tooltip title="Refresh">
                <Button 
                  icon={<ReloadOutlined />} 
                  shape="circle"
                  onClick={handleRefresh}
                  loading={isLoading}
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
              <Tooltip title="Help">
                <Button 
                  icon={<QuestionCircleOutlined />} 
                  shape="circle"
                  type="text"
                  onClick={() => setHelpModalVisible(true)}
                  size="small"
                />
              </Tooltip>
            </Space>
          </Col>
        </Row>
        
        <Content className="content-container">
          <Tabs 
            activeKey={activeTab} 
            onChange={handleTabChange}
            items={tabItems}
            className="main-tabs"
            size="large"
            tabBarStyle={{ marginBottom: 16 }}
            centered
            tabBarGutter={8}
          />
        </Content>
        
        <AppFooter statusMessage={statusMessage} />
        
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