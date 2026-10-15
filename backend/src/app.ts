/**
 * CatalystOS Backend — Express Application Setup
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';
import apiRouter from '../routes/api';
import voiceRouter from '../voice/routes';
import { validateEnvironmentConfig } from '../services/configValidator';

// Validate secrets on boot
validateEnvironmentConfig();

const app = express();

app.use(express.json({ limit: '10mb' }));

// 1. Mount Modularized Voice Studio & Speech API routes
app.use('/api/voice', voiceRouter);
app.use('/api/audio', voiceRouter);

// 2. Proxy /api/v1 endpoints to FastAPI service if running
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1')) {
    return createProxyMiddleware({
      target: process.env.FASTAPI_URL || 'http://127.0.0.1:8000',
      changeOrigin: true,
      proxyTimeout: 3000,
      timeout: 3000,
      on: {
        error: (_err, _req, res: any) => {
          if (res && typeof res.writeHead === 'function' && !res.headersSent) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'FastAPI service unavailable' }));
          }
        }
      }
    })(req, res, next);
  }
  next();
});

// 3. Section 37: Liveness and Readiness Probes
app.get('/health', (req, res) => {
  res.json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    pid: process.pid,
    nodeVersion: process.version
  });
});

app.get('/ready', async (req, res) => {
  const { isDbAvailable } = await import('../state');
  const { getRateLimiterMode } = await import('../services/rateLimiter');
  const isReady = process.env.NODE_ENV === 'production' ? isDbAvailable : true;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    databaseConnected: isDbAvailable,
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    rateLimiterMode: getRateLimiterMode(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 4. Mount Master API Routes
app.use('/api', apiRouter);

// 5. Catch unhandled /api routes before static middleware
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// 6. Support root /onboarding and /startup/onboarding API aliases for headless requests
app.use(['/onboarding', '/startup/onboarding'], (req, res, next) => {
  if (req.headers['content-type']?.includes('application/json') || req.headers['accept']?.includes('application/json') || req.method !== 'GET') {
    return apiRouter(req, res, next);
  }
  next();
});

// 7. Serve Static Frontend in Production if frontend/dist or dist exists
if (process.env.NODE_ENV === 'production') {
  const possibleDistPaths = [
    path.join(process.cwd(), 'frontend', 'dist'),
    path.join(process.cwd(), 'dist'),
    path.join(__dirname, '..', '..', 'dist'),
  ];
  
  for (const distPath of possibleDistPaths) {
    try {
      app.use(express.static(distPath));
      app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api')) return next();
        res.sendFile(path.join(distPath, 'index.html'));
      });
      break;
    } catch {}
  }
}

export default app;
