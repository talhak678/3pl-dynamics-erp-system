import React, { Component } from 'react';
import PageLoader from '@/components/PageLoader';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    const message = (error?.message || '') + '';
    const isChunkError =
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Loading chunk') ||
      message.includes('dynamically imported module') ||
      message.includes('error loading dynamically imported module');

    if (isChunkError) {
      const lastReload = sessionStorage.getItem('chunk_reload_timestamp');
      const now = Date.now();
      // Guard against infinite reload loops (reload at most once every 10 seconds)
      if (!lastReload || now - Number(lastReload) > 10000) {
        sessionStorage.setItem('chunk_reload_timestamp', String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const message = (this.state.error?.message || '') + '';
      const isChunkError =
        message.includes('Failed to fetch dynamically imported module') ||
        message.includes('Loading chunk') ||
        message.includes('dynamically imported module') ||
        message.includes('error loading dynamically imported module');

      if (isChunkError) {
        return <PageLoader />;
      }

      return (
        this.props.fallback || (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <h2>Something went wrong</h2>
            <p style={{ color: 'var(--app-text-secondary, #888)' }}>
              An unexpected error occurred while loading this view.
            </p>
            <button
              onClick={() => {
                sessionStorage.removeItem('chunk_reload_timestamp');
                window.location.reload();
              }}
              style={{
                marginTop: '16px',
                padding: '8px 20px',
                backgroundColor: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
