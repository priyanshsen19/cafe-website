import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Loads the demo catalogue on a freshly provisioned database.
 *
 * Runs at deploy time so a new environment comes up with something to look at
 * rather than an empty menu. It is deliberately conservative: it only ever acts
 * on a database with **no products at all**, so it can never overwrite real
 * data, and it is gated behind SEED_ON_EMPTY so it does nothing unless asked.
 */
async function main() {
  if (process.env.SEED_ON_EMPTY !== 'true') {
    console.log('[seed-if-empty] SEED_ON_EMPTY is not set — skipping.');
    return;
  }

  const prisma = new PrismaClient();

  try {
    const products = await prisma.product.count();

    if (products > 0) {
      console.log(`[seed-if-empty] Database already has ${products} products — leaving it alone.`);
      return;
    }

    console.log('[seed-if-empty] Empty database detected — loading the demo catalogue.');
    await prisma.$disconnect();

    execFileSync('npx', ['tsx', path.join(__dirname, 'seed.ts')], {
      stdio: 'inherit',
      env: process.env,
    });
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((error) => {
  // A failed seed must not stop the server from starting — an empty menu is a
  // far better outcome than a service that won't boot.
  console.error('[seed-if-empty] Seeding failed, continuing to start anyway:', error);
  process.exitCode = 0;
});
