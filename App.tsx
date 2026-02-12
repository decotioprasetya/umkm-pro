
import React, { useState } from 'react';
import { AppProvider, useApp } from './store';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Production from './pages/Production';
import Sales from './pages/Sales';
import Transactions from './pages/Transactions';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';

const AppContent: React.FC = () => {
  const { state } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');

  // Jika tab aktif adalah login, tampilkan halaman login secara full-screen
  if (activeTab === 'login') {
    return <Login onBack={() => setActiveTab('settings')} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'inventory':
        return <Inventory />;
      case 'production':
        return <Production />;
      case 'sales':
        return <Sales />;
      case 'finance':
        return <Transactions />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings onLoginClick={() => setActiveTab('login')} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {renderContent()}
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
