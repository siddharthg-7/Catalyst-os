/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiRouter from './backend/routes/api';
import voiceRouter from './backend/voice/routes';
import { validateEnvironmentConfig } from './backend/services/configValidator';

import { createProxyMiddleware } from 'http-proxy-middleware';

// Validate secrets on boot
validateEnvironmentConfig();

import { prisma } from './backend/services/dbService';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Pre-warm Neon PostgreSQL connection pool to eliminate signup/signin latency
prisma.$connect()
  .then(() => console.log('⚡ Neon PostgreSQL connection pool pre-warmed and ready.'))
  .catch((err) => console.warn('⚠️ Neon PostgreSQL pre-connect warning:', err.message));

app.use(express.json({ limit: '10mb' }));

// Mount modularized Voice Studio & Speech API routes (both /api/voice and legacy /api/audio)
app.use('/api/voice', voiceRouter);
app.use('/api/audio', voiceRouter);

// Proxy other /api/v1 endpoints to FastAPI only if configured
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

// Section 37: Liveness and Readiness Probes
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
  const { isDbAvailable } = await import('./backend/state');
  const { getRateLimiterMode } = await import('./backend/services/rateLimiter');
  const isReady = process.env.NODE_ENV === 'production' ? isDbAvailable : true;
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'ready' : 'degraded',
    databaseConnected: isDbAvailable,
    geminiConfigured: !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    rateLimiterMode: getRateLimiterMode(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount modularized backend API routes
app.use('/api', apiRouter);

// Catch unhandled /api routes before Vite middleware to prevent proxy loops
app.all('/api/*', (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` });
});

// Support root /onboarding and /startup/onboarding API aliases for headless/programmatic requests
app.use(['/onboarding', '/startup/onboarding'], (req, res, next) => {
  if (req.headers['content-type']?.includes('application/json') || req.headers['accept']?.includes('application/json') || req.method !== 'GET') {
    return apiRouter(req, res, next);
  }
  next();
});

import http from 'http';

// ==================================================
// VITE AND STATIC ASSETS SERVING SETUP
// ==================================================
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      root: path.resolve(process.cwd(), 'frontend'),
      configFile: path.resolve(process.cwd(), 'frontend', 'vite.config.ts'),
      server: {
        middlewareMode: true,
        hmr: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const frontendDist = path.join(process.cwd(), 'frontend', 'dist');
    const rootDist = path.join(process.cwd(), 'dist');
    const distPath = path.resolve(frontendDist);
    app.use(express.static(distPath));
    app.use(express.static(rootDist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      const htmlFile = path.join(distPath, 'index.html');
      res.sendFile(htmlFile, (err) => {
        if (err) res.sendFile(path.join(rootDist, 'index.html'));
      });
    });
  }

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [CatalystOS] Port ${PORT} is already in use by another process (EADDRINUSE).`);
      console.error(`💡 Tip: CatalystOS is a unified full-stack server (Express backend + Vite React frontend).`);
      console.error(`   You only need ONE running terminal instance with "npm run dev" in the project root.\n`);
      process.exit(1);
    } else {
      console.error('❌ [CatalystOS] Server error:', err);
      process.exit(1);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`CatalystOS Full-Stack Server active at http://0.0.0.0:${PORT}`);
  });
}

startServer();
