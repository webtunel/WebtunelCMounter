import React, { useState, useEffect, useRef } from 'react';
import { Modal, Button, Typography, Space, Spin, Divider, Badge, Tooltip } from 'antd';
import { 
  BugOutlined, 
  ClearOutlined, 
  ReloadOutlined, 
  DownloadOutlined,
  CopyOutlined, 
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';

const { Text, Title } = Typography;

const DebugViewer = ({ visible, onClose, className }) => {
  const [logs, setLogs] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const logContent = await window.api.getDebugLogs();
      setLogs(logContent);
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setLogs('Error loading logs: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    setLoading(true);
    try {
      await window.api.clearDebugLogs();
      setLogs('--- Logs cleared ---');
      setLastRefreshed(new Date());
    } catch (error) {
      console.error('Failed to clear logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyLogs = () => {
    if (logs) {
      navigator.clipboard.writeText(logs)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(err => {
          console.error('Failed to copy logs: ', err);
        });
    }
  };

  const downloadLogs = () => {
    if (logs) {
      const blob = new Blob([logs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const date = new Date();
      const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      a.download = `webtunelcmounter-logs-${formattedDate}.txt`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (visible) {
      fetchLogs();
    }
  }, [visible]);

  useEffect(() => {
    if (!loading) {
      scrollToBottom();
    }
  }, [loading, logs]);

  const formatTimestamp = (date) => {
    if (!date) return '';
    
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <Modal
      title={
        <Space align="center">
          <Badge count={<BugOutlined style={{ color: '#FF9500' }} />} offset={[0, 0]} />
          <Title level={5} style={{ margin: 0 }}>Debug Logs</Title>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      className={className}
      bodyStyle={{ padding: '16px 24px' }}
      footer={[
        <Button key="clear" onClick={clearLogs} icon={<ClearOutlined />} danger>
          Clear Logs
        </Button>,
        <Button key="download" onClick={downloadLogs} icon={<DownloadOutlined />}>
          Download
        </Button>,
        <Button 
          key="copy" 
          onClick={copyLogs} 
          icon={copied ? <CheckCircleOutlined /> : <CopyOutlined />}
          style={{ color: copied ? '#28CD41' : undefined }}
        >
          {copied ? 'Copied' : 'Copy'}
        </Button>,
        <Button key="refresh" onClick={fetchLogs} loading={loading} icon={<ReloadOutlined />}>
          Refresh
        </Button>,
        <Button key="close" type="primary" onClick={onClose}>
          Close
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <InfoCircleOutlined style={{ color: '#007AFF' }} />
          <Text>These logs help diagnose connection issues.</Text>
        </Space>
        {lastRefreshed && (
          <Tooltip title="Last refreshed">
            <Space size={4}>
              <ClockCircleOutlined style={{ opacity: 0.5 }} />
              <Text type="secondary">{formatTimestamp(lastRefreshed)}</Text>
            </Space>
          </Tooltip>
        )}
      </div>
      
      <Divider style={{ margin: '8px 0 16px' }} />
      
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading logs...</div>
        </div>
      ) : (
        <div className="debug-log-container" ref={logContainerRef}>
          {logs || 'No logs available'}
        </div>
      )}
    </Modal>
  );
};

export default DebugViewer;