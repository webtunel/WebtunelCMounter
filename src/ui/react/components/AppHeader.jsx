import React from 'react';
import { Layout } from 'antd';

const { Header } = Layout;

const AppHeader = () => {
  return (
    <Header className="app-header">
      <img src="../assets/icon.png" alt="WebtunelCMounter" className="app-logo" />
      <h1 className="app-title">WebtunelCMounter</h1>
    </Header>
  );
};

export default AppHeader;