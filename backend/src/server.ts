/**
 * CatalystOS Backend — Standalone HTTP Server Bootstrapper
 */

import http from 'http';
import app from './app';
import { prisma } from '../services/dbService';

const PORT = Number(process.env.PORT) || 3000;

async function startBackendServer() {
  const httpServer = http.createServer(app);

  // Pre-warm Neon PostgreSQL connection pool
  prisma.$connect()
    .then(() => console.log('⚡ Neon PostgreSQL connection pool pre-warmed and ready.'))
    .catch((err) => console.warn('⚠️ Neon PostgreSQL pre-connect warning:', err.message));

  httpServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ [CatalystOS Backend] Port ${PORT} is already in use by another process (EADDRINUSE).`);
      process.exit(1);
    } else {
      console.error('❌ [CatalystOS Backend] Server error:', err);
      process.exit(1);
    }
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CatalystOS Backend Server running at http://0.0.0.0:${PORT}`);
    console.log(`   Health Check: http://localhost:${PORT}/health`);
    console.log(`   API Endpoint: http://localhost:${PORT}/api`);
  });
}

startBackendServer();
