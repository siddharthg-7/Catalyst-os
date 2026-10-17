import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyPerformanceIndexes() {
  console.log('================================================================');
  console.log('⚡ APPLYING PERFORMANCE INDEXES ON NEON POSTGRESQL');
  console.log('================================================================\n');

  const indexes = [
    { name: 'idx_task_planId', sql: 'CREATE INDEX IF NOT EXISTS "idx_task_planId" ON "Task" ("planId");' },
    { name: 'idx_task_status', sql: 'CREATE INDEX IF NOT EXISTS "idx_task_status" ON "Task" ("status");' },
    { name: 'idx_task_assignedTo', sql: 'CREATE INDEX IF NOT EXISTS "idx_task_assignedTo" ON "Task" ("assignedTo");' },
    { name: 'idx_task_createdAt', sql: 'CREATE INDEX IF NOT EXISTS "idx_task_createdAt" ON "Task" ("createdAt" DESC);' },
    { name: 'idx_notification_startup_read', sql: 'CREATE INDEX IF NOT EXISTS "idx_notification_startup_read" ON "Notification" ("startupId", "read");' },
    { name: 'idx_notification_startup_createdAt', sql: 'CREATE INDEX IF NOT EXISTS "idx_notification_startup_createdAt" ON "Notification" ("startupId", "createdAt" DESC);' },
    { name: 'idx_approval_planId_status', sql: 'CREATE INDEX IF NOT EXISTS "idx_approval_planId_status" ON "Approval" ("planId", "status");' },
    { name: 'idx_approval_status', sql: 'CREATE INDEX IF NOT EXISTS "idx_approval_status" ON "Approval" ("status");' },
    { name: 'idx_plan_startupId_status', sql: 'CREATE INDEX IF NOT EXISTS "idx_plan_startupId_status" ON "Plan" ("startupId", "status");' }
  ];

  for (const idx of indexes) {
    try {
      const start = performance.now();
      await prisma.$executeRawUnsafe(idx.sql);
      const elapsed = performance.now() - start;
      console.log(`  ✅ Applied index [${idx.name}] in ${elapsed.toFixed(1)}ms`);
    } catch (err: any) {
      console.error(`  ❌ Failed applying [${idx.name}]:`, err.message);
    }
  }

  console.log('\n--- Verifying Index Creation ---');
  try {
    const createdIndexes: any[] = await prisma.$queryRawUnsafe(`
      SELECT indexname, tablename
      FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `);
    console.log(`  Verified ${createdIndexes.length} custom performance indexes in PostgreSQL:`);
    createdIndexes.forEach((ci: any) => console.log(`   - ${ci.tablename}: ${ci.indexname}`));
  } catch (err: any) {
    console.warn('  Verification query note:', err.message);
  }

  console.log('\n================================================================');
  console.log('🎉 Index Application Complete');
  console.log('================================================================');
  await prisma.$disconnect();
}

applyPerformanceIndexes();
