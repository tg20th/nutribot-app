import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      allowedHosts: true,
      proxy: {
        '/api/ai': {
          target: env.AI_SERVICE_PROXY_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
        '/api': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
        '/oauth2': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers['x-forwarded-proto'] === 'https') {
                proxyReq.setHeader('X-Forwarded-Port', '443');
                proxyReq.setHeader('X-Forwarded-Proto', 'https');
              }
              if (req.headers['x-forwarded-host']) {
                proxyReq.setHeader('X-Forwarded-Host', req.headers['x-forwarded-host']);
              }
            });
          },
        },
        '/login/oauth2': {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              if (req.headers['x-forwarded-proto'] === 'https') {
                proxyReq.setHeader('X-Forwarded-Port', '443');
                proxyReq.setHeader('X-Forwarded-Proto', 'https');
              }
              if (req.headers['x-forwarded-host']) {
                proxyReq.setHeader('X-Forwarded-Host', req.headers['x-forwarded-host']);
              }
            });
          },
        },
      },
    },
  };
});
