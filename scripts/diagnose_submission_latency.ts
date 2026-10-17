import { prisma, safeDbQuery } from '../backend/services/dbService';
import { updateTaskForUser } from '../backend/services/taskDelegationService';

async function diagnose() {
  console.log('Connecting to Neon...');
  await prisma.$connect();

  const tenantId = `diag_${Date.now()}`;
  const founderId = `diag_f_${Date.now()}`;
  const empId = `diag_e_${Date.now()}`;

  await prisma.user.createMany({
    data: [
      { id: founderId, email: `f_${Date.now()}@diag.test`, name: 'Diag Founder', role: 'Founder' },
      { id: empId, email: `e_${Date.now()}@diag.test`, name: 'Diag Emp', role: 'Growth' }
    ]
  });

  await prisma.startup.create({
    data: {
      id: tenantId,
      name: 'Diag Corp',
      industry: 'Software',
      description: 'Diag',
      ownerId: founderId
    }
  });

  await prisma.membership.createMany({
    data: [
      { startupId: tenantId, userId: founderId, role: 'FOUNDER', status: 'ACTIVE' },
      { startupId: tenantId, userId: empId, role: 'GROWTH', status: 'ACTIVE' }
    ]
  });

  const plan = await prisma.plan.create({
    data: { title: 'Diag Plan', description: 'Diag', status: 'active', startupId: tenantId }
  });

  const task = await prisma.task.create({
    data: { title: 'Diag Task', status: 'in_progress', assignedTo: `GROWTH:${empId}`, planId: plan.id }
  });

  console.log('Warmup complete. Starting timed updateTaskForUser...');
  const t0 = performance.now();
  const res = await updateTaskForUser({
    userId: empId,
    taskId: task.id,
    status: 'submitted',
    result: 'Deliverable completed.'
  });
  const elapsed = performance.now() - t0;
  console.log(`⏱️ updateTaskForUser took: ${elapsed.toFixed(2)}ms (Status: ${res.status})`);

  // Cleanup
  await prisma.task.deleteMany({ where: { planId: plan.id } });
  await prisma.plan.delete({ where: { id: plan.id } });
  await prisma.membership.deleteMany({ where: { startupId: tenantId } });
  await prisma.startup.delete({ where: { id: tenantId } });
  await prisma.user.deleteMany({ where: { id: { in: [founderId, empId] } } });
  await prisma.$disconnect();
}

diagnose().catch(console.error);
