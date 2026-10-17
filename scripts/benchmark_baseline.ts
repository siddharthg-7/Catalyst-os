import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runBenchmark() {
  console.log('================================================================');
  console.log('📊 CATALYST OS: PERFORMANCE AUDIT & BASELINE BENCHMARK');
  console.log('================================================================\n');

  try {
    // 1. Benchmark Task Query without index
    console.log('--- 1. Querying Tasks by Plan StartupId ---');
    const startTask = performance.now();
    const tasks = await prisma.task.findMany({
      include: {
        plan: { select: { startupId: true } }
      },
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    const taskDuration = performance.now() - startTask;
    console.log(`  Fetched ${tasks.length} tasks in ${taskDuration.toFixed(2)}ms`);

    // 2. Benchmark Notification Query without index
    console.log('\n--- 2. Querying Notifications ---');
    const startNotif = performance.now();
    const notifications = await prisma.notification.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' }
    });
    const notifDuration = performance.now() - startNotif;
    console.log(`  Fetched ${notifications.length} notifications in ${notifDuration.toFixed(2)}ms`);

    // 3. Inspect Query Plan for Task selection
    console.log('\n--- 3. Database Execution Plan (Task Table) ---');
    try {
      const taskPlan: any[] = await prisma.$queryRawUnsafe(`
        EXPLAIN ANALYZE SELECT * FROM "Task" ORDER BY "createdAt" DESC LIMIT 50;
      `);
      console.log('  Task query plan:');
      taskPlan.forEach((row: any) => console.log('   ', row['QUERY PLAN']));
    } catch (err: any) {
      console.log('  Could not run EXPLAIN on Task:', err.message);
    }

    // 4. Inspect Query Plan for Notification selection
    console.log('\n--- 4. Database Execution Plan (Notification Table) ---');
    try {
      const notifPlan: any[] = await prisma.$queryRawUnsafe(`
        EXPLAIN ANALYZE SELECT * FROM "Notification" ORDER BY "createdAt" DESC LIMIT 50;
      `);
      console.log('  Notification query plan:');
      notifPlan.forEach((row: any) => console.log('   ', row['QUERY PLAN']));
    } catch (err: any) {
      console.log('  Could not run EXPLAIN on Notification:', err.message);
    }

    console.log('\n================================================================');
    console.log('✅ Baseline Benchmark Complete');
    console.log('================================================================');
  } catch (err: any) {
    console.error('Benchmark error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runBenchmark();
