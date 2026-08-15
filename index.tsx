import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { autoValidateCacheVersion } from './src/shared/cacheManager';

// Automatically validate & synchronize cache version across all user devices on startup
autoValidateCacheVersion();

// Handle browser extension / message channel asynchronous response rejections gracefully
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = typeof reason === 'string'
    ? reason
    : (reason?.message || reason?.toString() || '');

  if (
    message.includes('A listener indicated an asynchronous response by returning true') ||
    message.includes('message channel closed before a response was received') ||
    message.includes('The message port closed before a response was received') ||
    message.includes('ResizeObserver loop completed with undelivered notifications')
  ) {
    event.preventDefault();
    event.stopPropagation();
  }
});

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      // Service worker registered
    }).catch(() => {
      // Ignore service worker registration errors
    });
  });
}

