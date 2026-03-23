import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_PROXY_TARGET = process.env.API_PROXY_TARGET || 'http://localhost:8000';

// Proxy API requests to the FastAPI backend
app.use('/api', createProxyMiddleware({ 
    target: API_PROXY_TARGET, 
    changeOrigin: true, 
    pathRewrite: { '^/api': '' },
    onProxyReq: (proxyReq, req, res) => {
        // Log requests being proxied
        console.log(`Proxying: ${req.method} ${req.originalUrl} to ${API_PROXY_TARGET}${proxyReq.path}`);
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(500).send('Proxy Error');
    }
}));

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// For all other requests, serve index.html (SPA fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Frontend server listening on port ${PORT}`);
  console.log(`API requests proxied to ${API_PROXY_TARGET}`);
});
