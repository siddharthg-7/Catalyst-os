import 'dotenv/config';
import { prisma } from '../services/dbService';

async function main() {
  console.log('Connecting to Neon Postgres...');
  const version: any = await prisma.$queryRawUnsafe('SELECT version()');
  console.log('PostgreSQL Version:', version[0].version);

  // Check extensions
  const extensions: any = await prisma.$queryRawUnsafe(`
    SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'uuid-ossp', 'pg_trgm');
  `);
  console.log('Installed extensions:', extensions);

  // Check existing counts
  const docCount = await prisma.startupDocument.count();
  const chunkCount = await prisma.knowledgeChunk.count();
  const embeddingCount = await prisma.embedding.count();
  console.log('Record counts:', { docCount, chunkCount, embeddingCount });

  // Check existing tables
  const tables: any = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
  `);
  console.log('Public tables count:', tables.length);
  console.log('Tables:', tables.map((t: any) => t.table_name));

  // Check columns of StartupDocument, KnowledgeChunk, Embedding
  const docCols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'StartupDocument';
  `);
  console.log('StartupDocument columns:', docCols);

  const chunkCols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'KnowledgeChunk';
  `);
  console.log('KnowledgeChunk columns:', chunkCols);

  const embedCols: any = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'Embedding';
  `);
  console.log('Embedding columns:', embedCols);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
