import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);

// Removed Service Worker registration to resolve navigation fetch failures
